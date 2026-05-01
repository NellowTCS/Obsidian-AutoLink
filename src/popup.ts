import {
  EditorSuggest,
  App,
  type EditorPosition,
  Editor,
  TFile,
  type EditorSuggestTriggerInfo,
  type EditorSuggestContext,
} from "obsidian";
import type { AutoLinkPluginContext } from "./types";
import { getBestMatch, acceptSuggestion, isInsideLink } from "./editor";
import { findMatches } from "./notes";
import type { NoteMatch } from "./types";
import type AutoLinkPlugin from "./main";

export class AutoLinkEditorSuggest extends EditorSuggest<NoteMatch> {
  plugin: AutoLinkPluginContext;

  constructor(app: App, plugin: AutoLinkPlugin) {
    super(app);
    this.plugin = plugin;

    this.setInstructions([
      { command: "↑↓", purpose: "Navigate" },
      { command: "↵", purpose: "Select" },
      { command: "Esc", purpose: "Dismiss" },
    ]);
  }

  onTrigger(
    cursor: EditorPosition,
    editor: Editor,
    file: TFile,
  ): EditorSuggestTriggerInfo | null {
    const mode = this.plugin.settings.mode;

    // Only show popup for suggestions/custom modes
    if (mode !== "suggestions" && mode !== "custom") return null;
    if (this.plugin.isAutoLinkDisabled) return null;

    const line = editor.getLine(cursor.line);

    // Strip bullet prefix so we check the real content
    const bulletMatch = line.match(/^(\s*)([-*+]|\d+\.)\s+/);
    const bulletPrefix = bulletMatch ? bulletMatch[0] : "";
    const processedLine = line.slice(bulletPrefix.length);
    const processedCh = Math.max(0, cursor.ch - bulletPrefix.length);

    if (isInsideLink(processedLine, processedCh)) return null;

    const beforeCursor = processedLine.slice(0, processedCh);
    const match = beforeCursor.match(/[\w\s\-_]+$/);
    if (!match) return null;

    const currentBasename = file?.basename || "";
    const bestMatch = getBestMatch(this.plugin, match[0], currentBasename);
    const typed = bestMatch.term;

    if (typed.length < this.plugin.settings.minWordLength) return null;
    if (bestMatch.matches.length === 0) return null;

    // In custom mode, if auto-insert is on and there's exactly one match, let the
    // main handler deal with it instead of showing a popup
    if (
      mode === "custom" &&
      this.plugin.settings.customAutoInsertSingleMatch &&
      bestMatch.matches.length === 1
    ) {
      return null;
    }

    const typedStart = beforeCursor.lastIndexOf(typed);

    return {
      start: { line: cursor.line, ch: bulletPrefix.length + typedStart },
      end: cursor,
      query: typed,
    };
  }

  getSuggestions(context: EditorSuggestContext): NoteMatch[] {
    const activeFile = this.app.workspace.getActiveFile();
    const currentBasename = activeFile?.basename || "";
    return findMatches(this.plugin, context.query, currentBasename);
  }

  renderSuggestion(match: NoteMatch, el: HTMLElement): void {
    const displayTitle = match.isAlias
      ? `${match.title} → ${match.file.basename}`
      : match.title;

    el.createDiv({
      text: displayTitle,
      cls: "autolink-suggestion-title",
    });
    el.createEl("small", {
      text: match.file.path,
      cls: "autolink-suggestion-path",
    });
  }

  selectSuggestion(match: NoteMatch, _evt: MouseEvent | KeyboardEvent): void {
    const context = this.context;
    if (!context) return;

    acceptSuggestion(this.plugin, context.editor, match, context.query);
    this.close();
  }
}
