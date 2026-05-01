import { Plugin, Editor, MarkdownView, TFile, debounce } from "obsidian";
import type { EventRef } from "obsidian";
import {
  DEFAULT_SETTINGS,
  type AutoLinkSettings,
  type NoteMatch,
} from "./types";
import { AutoLinkEditorSuggest } from "./popup";
import { AutoLinkSettingTab } from "./settings";
import { updateNoteList } from "./notes";
import {
  handleEditorChange,
  temporarilyDisableAutoLink,
  undoLastAutolink,
} from "./editor";

export default class AutoLinkPlugin extends Plugin {
  settings!: AutoLinkSettings;
  noteTitles: Map<string, TFile> = new Map();
  aliases: Map<string, TFile> = new Map();
  lastTypedWord: string = "";
  undoStack: Array<{
    line: number;
    original: string;
    cursor: { line: number; ch: number };
    timestamp?: number;
    linkText?: string;
  }> = [];

  pendingMatches: Map<string, NoteMatch[]> = new Map();
  isAutoLinkDisabled: boolean = false;
  disableTimeout: number | null = null;

  // will be set in onload using Obsidian debounce()
  handleEditorChangeDebounced: (editor: Editor, view: MarkdownView) => void =
    () => {};

  async onload() {
    await this.loadSettings();

    // Build initial note and alias lists
    updateNoteList(this);

    // Wait for layout ready before registering events so we don't re-run on startup passes
    this.app.workspace.onLayoutReady(() => {
      // Vault events
      this.registerEvent(
        this.app.vault.on("create", (file) => {
          if (file instanceof TFile && file.extension === "md") {
            updateNoteList(this);
          }
        }),
      );

      this.registerEvent(
        this.app.vault.on("rename", (file) => {
          if (file instanceof TFile && file.extension === "md") {
            updateNoteList(this);
          }
        }),
      );

      this.registerEvent(
        this.app.vault.on("delete", (file) => {
          if (file instanceof TFile && file.extension === "md") {
            updateNoteList(this);
          }
        }),
      );

      // Use Obsidian debounce API for editor changes
      this.handleEditorChangeDebounced = debounce(
        (editor: Editor, view: MarkdownView) => {
          handleEditorChange(this, editor, view);
        },
        this.settings.debounceMs,
      );

      const workspace = this.app.workspace as unknown as {
        on(
          name: string,
          callback: (editor: Editor, view: MarkdownView) => void,
        ): EventRef;
      };

      this.registerEvent(
        workspace.on("editor-change", (editor: Editor, view: MarkdownView) => {
          this.handleEditorChangeDebounced(editor, view);
        }),
      );
    });

    const doc = window.activeDocument;
    if (doc) {
      this.registerDomEvent(doc, "keydown", (evt: KeyboardEvent) => {
        if (
          (evt.key === "Backspace" || evt.key === "Delete") &&
          this.undoStack.length > 0
        ) {
          const activeView =
            this.app.workspace.getActiveViewOfType(MarkdownView);
          if (activeView?.editor) {
            const cursor = activeView.editor.getCursor();
            const lastUndo = this.undoStack[this.undoStack.length - 1];

            if (
              lastUndo &&
              cursor.line === lastUndo.line &&
              lastUndo.linkText
            ) {
              const currentLine = activeView.editor.getLine(cursor.line);

              const linkRegex = /\[\[([^|\]]+)(?:\|[^\]]+)?\]\]/g;
              let match;
              while ((match = linkRegex.exec(currentLine)) !== null) {
                const baseText = match[1];

                if (baseText === lastUndo.linkText) {
                  const linkStart = match.index;
                  const linkEnd = linkStart + match[0].length;

                  const isBackspaceNearLink =
                    evt.key === "Backspace" &&
                    cursor.ch > linkStart &&
                    cursor.ch <= linkEnd;
                  const isDeleteNearLink =
                    evt.key === "Delete" &&
                    cursor.ch >= linkStart &&
                    cursor.ch < linkEnd;

                  if (isBackspaceNearLink || isDeleteNearLink) {
                    const timeSinceAutoLink =
                      Date.now() - (lastUndo.timestamp || 0);
                    const timeLimit = 30000; // 30 seconds

                    if (!lastUndo.timestamp || timeSinceAutoLink <= timeLimit) {
                      evt.preventDefault();
                      temporarilyDisableAutoLink(this);
                      undoLastAutolink(this, activeView.editor);
                    }
                    return;
                  }
                }
              }
            }
          }
        }
      });
    }

    // Add command for undo functionality
    this.addCommand({
      id: "undo-link",
      name: "Undo last auto-link",
      editorCallback: (editor: Editor) => {
        if (this.undoStack.length > 0) {
          temporarilyDisableAutoLink(this);
          undoLastAutolink(this, editor);
        }
      },
    });

    // Register the EditorSuggest for suggestions/custom modes
    this.registerEditorSuggest(new AutoLinkEditorSuggest(this.app, this));

    // Add settings tab
    this.addSettingTab(new AutoLinkSettingTab(this.app, this));
  }

  onunload() {
    const win = window.activeWindow;
    if (this.disableTimeout && win) {
      win.clearTimeout(this.disableTimeout);
    }
  }

  async loadSettings() {
    const data = (await this.loadData()) as Partial<AutoLinkSettings>;
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}
