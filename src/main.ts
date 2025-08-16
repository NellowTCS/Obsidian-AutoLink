import {
	Plugin,
	Editor,
	MarkdownView,
	TFile,
	Notice,
	PluginSettingTab,
	App,
	Setting,
} from "obsidian";
import SuggestionPopup from "./SuggestionPopup.svelte";
import { mount, unmount } from "svelte";

type Mode = "autonomous" | "semiAutonomous" | "suggestions" | "custom";

interface AutoLinkSettings {
	mode: Mode;
	minWordLength: number;
	caseSensitive: boolean;
	includeAliases: boolean;
	customFolders: string[];
	debounceMs: number;
	maxSuggestions: number;
	// New settings for custom mode
	customAllowEnterAccept: boolean;
	customAutoInsertSingleMatch: boolean;
}

const DEFAULT_SETTINGS: AutoLinkSettings = {
	mode: "autonomous",
	minWordLength: 3,
	caseSensitive: false,
	includeAliases: true,
	customFolders: [],
	debounceMs: 300,
	maxSuggestions: 10,
	customAllowEnterAccept: true,
	customAutoInsertSingleMatch: true,
};

export default class AutoLinkPlugin extends Plugin {
	settings: AutoLinkSettings;
	noteTitles: Map<string, TFile> = new Map();
	aliases: Map<string, TFile> = new Map();
	popup: any = null;
	debounceTimer: number | null = null;
	lastTypedWord: string = "";
	undoStack: Array<{
		line: number;
		original: string;
		cursor: { line: number; ch: number };
	}> = [];
	
	// Track pending matches for wait-and-see behavior
	pendingMatches: Map<string, Array<{ title: string; file: TFile; isAlias: boolean }>> = new Map();
	// Add flag to temporarily disable auto-linking to prevent chaos during undo
	isAutoLinkDisabled: boolean = false;
	disableTimeout: number | null = null;

	async onload() {
		await this.loadSettings();

		console.log("AutoLink plugin loaded");

		// Build initial note and alias lists
		this.updateNoteList();

		// Listen for file operations
		this.registerEvent(
			this.app.vault.on("create", (file) => {
				if (file instanceof TFile && file.extension === "md") {
					this.updateNoteList();
				}
			})
		);

		this.registerEvent(
			this.app.vault.on("rename", (file) => {
				if (file instanceof TFile && file.extension === "md") {
					this.updateNoteList();
				}
			})
		);

		this.registerEvent(
			this.app.vault.on("delete", (file) => {
				if (file instanceof TFile && file.extension === "md") {
					this.updateNoteList();
				}
			})
		);

		// Editor change handler with debouncing
		this.registerEvent(
			this.app.workspace.on(
				"editor-change",
				(editor: Editor, view: MarkdownView) => {
					this.handleEditorChangeDebounced(editor, view);
				}
			)
		);

		// Add immediate backspace/delete undo functionality
		this.registerDomEvent(document, "keydown", (evt: KeyboardEvent) => {
			if ((evt.key === "Backspace" || evt.key === "Delete") && this.undoStack.length > 0) {
				const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (activeView?.editor) {
					const cursor = activeView.editor.getCursor();
					const lastUndo = this.undoStack[this.undoStack.length - 1];
					
					// Check if we're right after a recent auto-link
					if (lastUndo && cursor.line === lastUndo.line) {
						const currentLine = activeView.editor.getLine(cursor.line);
						// If the line contains a link that wasn't in the original, offer immediate undo
						if (currentLine.includes("[[") && !lastUndo.original.includes("[[")) {
							evt.preventDefault();
							// Temporarily disable auto-linking to prevent chaos >:3
							this.temporarilyDisableAutoLink();
							this.undoLastAutolink(activeView.editor);
						}
					}
				}
			}
		});

		// Add command for undo functionality
		this.addCommand({
			id: "undo-autolink",
			name: "Undo last auto-link",
			hotkeys: [{ modifiers: ["Mod", "Shift"], key: "z" }],
			editorCallback: (editor: Editor) => {
				if (this.undoStack.length > 0) {
          this.temporarilyDisableAutoLink();
					this.undoLastAutolink(editor);
				}
			},
		});

		// Add settings tab
		this.addSettingTab(new AutoLinkSettingTab(this.app, this));
	}

	onunload() {
		console.log("AutoLink plugin unloaded");
		this.closePopup();
		if (this.debounceTimer) {
			clearTimeout(this.debounceTimer);
		}
		if (this.disableTimeout) {
			clearTimeout(this.disableTimeout);
		}
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	updateNoteList() {
		this.noteTitles.clear();
		this.aliases.clear();

		const files = this.getRelevantFiles();

		files.forEach((file) => {
			// Add file basename
			const basename = file.basename;
			this.noteTitles.set(
				this.settings.caseSensitive ? basename : basename.toLowerCase(),
				file
			);

			// Add aliases if enabled
			if (this.settings.includeAliases) {
				const cache = this.app.metadataCache.getFileCache(file);
				if (cache?.frontmatter?.aliases) {
					const aliases = Array.isArray(cache.frontmatter.aliases)
						? cache.frontmatter.aliases
						: [cache.frontmatter.aliases];

					aliases.forEach((alias: string) => {
						if (typeof alias === "string" && alias.trim()) {
							const key = this.settings.caseSensitive
								? alias
								: alias.toLowerCase();
							this.aliases.set(key, file);
						}
					});
				}
			}
		});
	}

	getRelevantFiles(): TFile[] {
		const allFiles = this.app.vault.getMarkdownFiles();

		if (this.settings.mode === "semiAutonomous") {
			const activeFile = this.app.workspace.getActiveFile();
			if (!activeFile) return allFiles;

			const activeFolder = activeFile.parent;
			return allFiles.filter((file) => file.parent === activeFolder);
		}

		if (
			this.settings.mode === "custom" &&
			this.settings.customFolders.length > 0
		) {
			return allFiles.filter((file) => {
				return this.settings.customFolders.some((folder) =>
					file.path.startsWith(folder === "/" ? "" : folder + "/")
				);
			});
		}

		return allFiles;
	}

	handleEditorChangeDebounced(editor: Editor, view: MarkdownView) {
		if (this.debounceTimer) {
			clearTimeout(this.debounceTimer);
		}

		this.debounceTimer = window.setTimeout(() => {
			this.handleEditorChange(editor, view);
		}, this.settings.debounceMs);
	}

	handleEditorChange(editor: Editor, view: MarkdownView) {
		if (!editor || !view) return;
		
		// Don't process if auto-linking is temporarily disabled
		if (this.isAutoLinkDisabled) return;

		const cursor = editor.getCursor();
		const line = editor.getLine(cursor.line);

		// Don't process if cursor is inside existing link
		if (this.isInsideLink(line, cursor.ch)) return;

		// Get current word being typed
		const beforeCursor = line.slice(0, cursor.ch);
		const match = beforeCursor.match(/[\w\s\-_]+$/);
		if (!match) {
			this.closePopup();
			this.pendingMatches.clear();
			return;
		}

		const typed = match[0].trim();
		if (typed.length < this.settings.minWordLength) {
			this.closePopup();
			this.pendingMatches.clear();
			return;
		}

		// Avoid linking to current file
		const currentFile = view.file;
		const currentBasename = currentFile?.basename || "";
		const matches = this.findMatches(typed, currentBasename);

		// Store current matches for wait-and-see behavior
		this.pendingMatches.set(typed, matches);

		// Check if we just completed a word (typed space, punctuation, etc.)
		const justTypedChar = cursor.ch > 0 ? line[cursor.ch - 1] : "";
		const isWordCompleting = /[\s.,!?;:()[\]{}|\\/<>@#$%^&*+=~`"'-]/.test(
			justTypedChar
		);

		// Handle word completion for autonomous modes
		if (
			(this.settings.mode === "autonomous" ||
				this.settings.mode === "semiAutonomous") &&
			isWordCompleting
		) {
			// Look for the completed word before the delimiter
			const beforeDelimiter = line.slice(0, cursor.ch - 1);
			const wordMatch = beforeDelimiter.match(/[\w\s\-_]+$/);

			if (wordMatch) {
				const completedWord = wordMatch[0].trim();
				const completedMatches = this.findMatches(completedWord, currentBasename);
				
				// Wait-and-see logic: only auto-link if there's exactly one match
				// OR if we had multiple matches before but now only one matches the completed word
				if (completedMatches.length === 1) {
					// Check if we were waiting on this word
					const wasWaiting = this.pendingMatches.has(completedWord) && 
						this.pendingMatches.get(completedWord)!.length > 1;
					
					if (wasWaiting || completedMatches.length === 1) {
						this.insertLinkForCompletedWord(
							editor,
							completedWord,
							completedMatches[0],
							cursor.ch - 1
						);
						this.pendingMatches.clear();
						return;
					}
				}
			}
		}

		// Handle suggestions based on mode
		switch (this.settings.mode) {
			case "autonomous":
			case "semiAutonomous":
				// Only show suggestions if multiple matches while typing (disambiguation)
				if (matches.length > 1) {
					this.handleSuggestionsMode(editor, matches, typed);
				} else {
					this.closePopup();
				}
				break;

			case "suggestions":
				this.handleSuggestionsMode(editor, matches, typed);
				break;

			case "custom":
				if (matches.length === 1 && this.settings.customAutoInsertSingleMatch) {
					// Auto-insert single matches in custom mode if enabled
					this.handleAutonomousMode(editor, typed, matches, cursor);
				} else if (matches.length > 0) {
					this.handleSuggestionsMode(editor, matches, typed);
				} else {
					this.closePopup();
				}
				break;
		}
	}

	isInsideLink(line: string, ch: number): boolean {
		// Check if cursor is inside [[link]] or [text](url)
		const beforeCursor = line.slice(0, ch);
		const afterCursor = line.slice(ch);

		// Wiki-style links
		const openBrackets = (beforeCursor.match(/\[\[/g) || []).length;
		const closeBrackets = (beforeCursor.match(/\]\]/g) || []).length;
		if (openBrackets > closeBrackets) return true;

		// Markdown links
		const lastOpenBracket = beforeCursor.lastIndexOf("[");
		const lastCloseBracket = beforeCursor.lastIndexOf("]");
		if (lastOpenBracket > lastCloseBracket && afterCursor.includes("]("))
			return true;

		return false;
	}

	findMatches(
		typed: string,
		currentBasename: string
	): Array<{ title: string; file: TFile; isAlias: boolean }> {
		const searchKey = this.settings.caseSensitive
			? typed
			: typed.toLowerCase();
		const matches: Array<{ title: string; file: TFile; isAlias: boolean }> =
			[];

		// Search in note titles
		for (const [title, file] of this.noteTitles.entries()) {
			if (
				title !==
					(this.settings.caseSensitive
						? currentBasename
						: currentBasename.toLowerCase()) &&
				title.startsWith(searchKey)
			) {
				matches.push({ title: file.basename, file, isAlias: false });
			}
		}

		// Search in aliases
		for (const [alias, file] of this.aliases.entries()) {
			if (
				file.basename !== currentBasename &&
				alias.startsWith(searchKey)
			) {
				// Don't add duplicate if we already have the file from title search
				if (!matches.find((m) => m.file === file)) {
					matches.push({ title: alias, file, isAlias: true });
				}
			}
		}

		return matches.slice(0, this.settings.maxSuggestions);
	}

	insertLinkForCompletedWord(
		editor: Editor,
		completedWord: string,
		match: { title: string; file: TFile; isAlias: boolean },
		delimiterPos: number
	) {
		const cursor = editor.getCursor();
		const line = editor.getLine(cursor.line);

		// Store for undo
		this.undoStack.push({
			line: cursor.line,
			original: line,
			cursor: { line: cursor.line, ch: cursor.ch },
		});

		// Create the link
		const link = `[[${match.file.basename}${
			match.isAlias ? "|" + match.title : ""
		}]]`;

		// Find the start position of the completed word
		const beforeDelimiter = line.slice(0, delimiterPos);
		const wordStart = Math.max(
			0,
			beforeDelimiter.length - completedWord.length
		);

		// Replace the completed word with the link, keeping the delimiter
		const newLine =
			line.slice(0, wordStart) + link + line.slice(delimiterPos);
		editor.setLine(cursor.line, newLine);

		// Position cursor after the link and delimiter, but ensure it's within bounds
		const newCursorPos = wordStart + link.length + 1;
		editor.setCursor({
			line: cursor.line,
			ch: Math.min(newLine.length, newCursorPos),
		});

		// Keep only last 10 undo operations
		if (this.undoStack.length > 10) {
			this.undoStack.shift();
		}
	}

	handleAutonomousMode(
		editor: Editor,
		typed: string,
		matches: Array<{ title: string; file: TFile; isAlias: boolean }>,
		cursor: any
	) {
		// Only auto-link if there's exactly one match
		if (matches.length === 1) {
			const match = matches[0];
			const line = editor.getLine(cursor.line);

			// Store for undo
			this.undoStack.push({
				line: cursor.line,
				original: line,
				cursor: { line: cursor.line, ch: cursor.ch },
			});

			// Create the link
			const link = `[[${match.file.basename}${
				match.isAlias ? "|" + match.title : ""
			}]]`;

			const newLine = line.replace(
				new RegExp(`${this.escapeRegex(typed)}$`),
				link
			);
			editor.setLine(cursor.line, newLine);
			editor.setCursor({
				line: cursor.line,
				ch: cursor.ch - typed.length + link.length,
			});

			// Keep only last 10 undo operations
			if (this.undoStack.length > 10) {
				this.undoStack.shift();
			}
		}

		this.closePopup();
	}

	handleSuggestionsMode(
		editor: Editor,
		matches: Array<{ title: string; file: TFile; isAlias: boolean }>,
		typed: string
	) {
		if (matches.length > 0) {
			this.showSuggestionPopup(editor, matches, typed);
		} else {
			this.closePopup();
		}
	}

	showSuggestionPopup(
		editor: Editor,
		matches: Array<{ title: string; file: TFile; isAlias: boolean }>,
		typed: string
	) {
		// Don't show popup in autonomous mode when there are multiple matches with same prefix
		if ((this.settings.mode === "autonomous" || this.settings.mode === "semiAutonomous") && matches.length > 1) {
			// Check if all matches share a common prefix longer than what's typed
			const commonPrefix = this.findCommonPrefix(matches.map(m => m.title.toLowerCase()));
			if (commonPrefix.length > typed.length) {
				// Wait for more typing instead of showing popup
				this.closePopup();
				return;
			}
		}

		this.closePopup();

		// Get cursor position for popup placement
		const cursor = editor.getCursor();
		const coords = this.getCursorCoordinates(editor, cursor);

		// Create a simple container div first to avoid Svelte instantiation issues
		const popupContainer = document.createElement("div");
		popupContainer.id = "autolink-popup-container";
		document.body.appendChild(popupContainer);

		try {
			// Use Svelte 5's mount function instead of new Component()
			this.popup = mount(SuggestionPopup, {
				target: popupContainer,
				props: {
					matches,
					editor,
					typed,
					position: coords,
					allowEnterAccept: this.settings.mode === "suggestions" || 
						(this.settings.mode === "custom" && this.settings.customAllowEnterAccept),
					onAccept: (match: {
						title: string;
						file: TFile;
						isAlias: boolean;
					}) => this.acceptSuggestion(editor, match, typed),
					onClose: () => this.closePopup(),
				},
			});
		} catch (error) {
			console.error("Error creating suggestion popup:", error);
			// Clean up container if creation fails
			if (popupContainer.parentNode) {
				popupContainer.parentNode.removeChild(popupContainer);
			}
		}
	}

	findCommonPrefix(strings: string[]): string {
		if (strings.length === 0) return "";
		
		let prefix = "";
		const firstString = strings[0];
		
		for (let i = 0; i < firstString.length; i++) {
			const char = firstString[i];
			if (strings.every(str => str[i] === char)) {
				prefix += char;
			} else {
				break;
			}
		}
		
		return prefix;
	}

	getCursorCoordinates(editor: Editor, cursor: { line: number; ch: number }): { left: number; top: number; bottom: number } {
		// Try to get precise cursor coordinates
		try {
			const cm = (editor as any).cm;
			if (cm && cm.coordsChar) {
				const coords = cm.coordsAtPos(cursor);
				return {
					left: coords.left,
					top: coords.top,
					bottom: coords.bottom || coords.top + 20
				};
			}
		} catch (error) {
			// Fallback method
		}

		// Fallback: approximate position - position popup BELOW the current line
		const editorEl = (editor as any).containerEl || document.querySelector(".cm-editor");
		if (editorEl) {
			const rect = editorEl.getBoundingClientRect();
			const lineHeight = 20; // Approximate line height
			const topOfCurrentLine = rect.top + cursor.line * lineHeight;
			const bottomOfCurrentLine = topOfCurrentLine + lineHeight;
			
			return {
				left: rect.left + 20,
				top: topOfCurrentLine,
				bottom: bottomOfCurrentLine, // This is where we want the popup to start
			};
		}

		return { left: 0, top: 0, bottom: 0 };
	}

	acceptSuggestion(
		editor: Editor,
		match: { title: string; file: TFile; isAlias: boolean },
		typed: string
	) {
		const cursor = editor.getCursor();
		const line = editor.getLine(cursor.line);

		// Store for undo
		this.undoStack.push({
			line: cursor.line,
			original: line,
			cursor: { line: cursor.line, ch: cursor.ch },
		});

		const link = `[[${match.file.basename}${
			match.isAlias ? "|" + match.title : ""
		}]]`;

		// Find the start position of the typed text
		const beforeCursor = line.slice(0, cursor.ch);
		const typedStartIndex = beforeCursor.lastIndexOf(typed);

		if (typedStartIndex === -1) {
			// Fallback: replace at the end
			const newLine = line.replace(
				new RegExp(`${this.escapeRegex(typed)}$`),
				link
			);
			editor.setLine(cursor.line, newLine);
			editor.setCursor({
				line: cursor.line,
				ch: Math.min(
					newLine.length,
					cursor.ch - typed.length + link.length
				),
			});
		} else {
			// Replace the typed text with the link
			const newLine =
				line.slice(0, typedStartIndex) +
				link +
				line.slice(typedStartIndex + typed.length);
			editor.setLine(cursor.line, newLine);

			// Set cursor position after the link, but ensure it's within bounds
			const newCursorPos = typedStartIndex + link.length;
			editor.setCursor({
				line: cursor.line,
				ch: Math.min(newLine.length, newCursorPos),
			});
		}

		this.closePopup();
		
		// Keep only last 10 undo operations
		if (this.undoStack.length > 10) {
			this.undoStack.shift();
		}
	}

	temporarilyDisableAutoLink() {
		this.isAutoLinkDisabled = true;
		
		// Clear any existing timeout
		if (this.disableTimeout) {
			clearTimeout(this.disableTimeout);
		}
		
		// Re-enable after 1 second
		this.disableTimeout = window.setTimeout(() => {
			this.isAutoLinkDisabled = false;
			this.disableTimeout = null;
		}, 1000);
	}

	undoLastAutolink(editor: Editor) {
		if (this.undoStack.length === 0) return;

		const lastAction = this.undoStack.pop()!;
		editor.setLine(lastAction.line, lastAction.original);
		editor.setCursor(lastAction.cursor);

		new Notice("Auto-link undone");
	}

	closePopup() {
		if (this.popup) {
			// Use Svelte 5's unmount function instead of $destroy()
			unmount(this.popup);
			this.popup = null;
		}

		// Clean up the container
		const container = document.getElementById("autolink-popup-container");
		if (container && container.parentNode) {
			container.parentNode.removeChild(container);
		}
	}

	escapeRegex(string: string): string {
		return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	}
}

class AutoLinkSettingTab extends PluginSettingTab {
	plugin: AutoLinkPlugin;

	constructor(app: App, plugin: AutoLinkPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h2", { text: "AutoLink Settings" });

		new Setting(containerEl)
			.setName("Mode")
			.setDesc("Choose how auto-linking behaves")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("autonomous", "Autonomous - Auto-link all notes")
					.addOption(
						"semiAutonomous",
						"Semi-Autonomous - Only current folder"
					)
					.addOption(
						"suggestions",
						"Suggestions - Show popup for confirmation"
					)
					.addOption("custom", "Custom - Use custom settings")
					.setValue(this.plugin.settings.mode)
					.onChange(async (value) => {
						this.plugin.settings.mode = value as Mode;
						await this.plugin.saveSettings();
						this.plugin.updateNoteList();
						// Refresh settings display to show/hide custom options
						this.display();
					})
			);

		new Setting(containerEl)
			.setName("Minimum word length")
			.setDesc(
				"Minimum number of characters before auto-linking kicks in"
			)
			.addSlider((slider) =>
				slider
					.setLimits(1, 10, 1)
					.setValue(this.plugin.settings.minWordLength)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.minWordLength = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Case sensitive matching")
			.setDesc("Whether to match note titles case-sensitively")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.caseSensitive)
					.onChange(async (value) => {
						this.plugin.settings.caseSensitive = value;
						await this.plugin.saveSettings();
						this.plugin.updateNoteList();
					})
			);

		new Setting(containerEl)
			.setName("Include aliases")
			.setDesc("Also match against note aliases from frontmatter")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.includeAliases)
					.onChange(async (value) => {
						this.plugin.settings.includeAliases = value;
						await this.plugin.saveSettings();
						this.plugin.updateNoteList();
					})
			);

		new Setting(containerEl)
			.setName("Debounce delay (ms)")
			.setDesc("How long to wait after typing stops before processing")
			.addSlider((slider) =>
				slider
					.setLimits(50, 1000, 50)
					.setValue(this.plugin.settings.debounceMs)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.debounceMs = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Max suggestions")
			.setDesc("Maximum number of suggestions to show in popup mode")
			.addSlider((slider) =>
				slider
					.setLimits(1, 20, 1)
					.setValue(this.plugin.settings.maxSuggestions)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.maxSuggestions = value;
						await this.plugin.saveSettings();
					})
			);

		// Custom mode settings - only show when custom mode is selected
		if (this.plugin.settings.mode === "custom") {
			containerEl.createEl("h3", { text: "Custom Mode Settings" });

			new Setting(containerEl)
				.setName("Allow Enter to accept suggestions")
				.setDesc("Whether Enter key should accept suggestions in custom mode")
				.addToggle((toggle) =>
					toggle
						.setValue(this.plugin.settings.customAllowEnterAccept)
						.onChange(async (value) => {
							this.plugin.settings.customAllowEnterAccept = value;
							await this.plugin.saveSettings();
						})
				);

			new Setting(containerEl)
				.setName("Auto-insert single matches")
				.setDesc("Automatically insert links when there's only one matching note")
				.addToggle((toggle) =>
					toggle
						.setValue(this.plugin.settings.customAutoInsertSingleMatch)
						.onChange(async (value) => {
							this.plugin.settings.customAutoInsertSingleMatch = value;
							await this.plugin.saveSettings();
						})
				);

			new Setting(containerEl)
				.setName("Custom folders")
				.setDesc(
					"Comma-separated list of folders to include in custom mode (use / for root)"
				)
				.addTextArea((text) =>
					text
						.setPlaceholder("folder1, folder2/subfolder, /")
						.setValue(this.plugin.settings.customFolders.join(", "))
						.onChange(async (value) => {
							this.plugin.settings.customFolders = value
								.split(",")
								.map((f) => f.trim())
								.filter((f) => f.length > 0);
							await this.plugin.saveSettings();
							this.plugin.updateNoteList();
						})
				);
		}
	}
}