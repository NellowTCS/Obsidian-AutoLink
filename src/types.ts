import type { App, Editor, MarkdownView, TFile } from "obsidian";

export type Mode = "autonomous" | "semiAutonomous" | "suggestions" | "custom";

export interface AutoLinkSettings {
  mode: Mode;
  minWordLength: number;
  caseSensitive: boolean;
  includeAliases: boolean;
  customFolders: string[];
  debounceMs: number;
  maxSuggestions: number;
  customAllowEnterAccept: boolean;
  customAutoInsertSingleMatch: boolean;
}

export interface AutoLinkPluginContext {
  app: App;
  noteTitles: Map<string, TFile>;
  aliases: Map<string, TFile>;
  settings: AutoLinkSettings;
  pendingMatches: Map<string, NoteMatch[]>;
  isAutoLinkDisabled: boolean;
  disableTimeout: number | null;
  undoStack: Array<{
    line: number;
    original: string;
    cursor: { line: number; ch: number };
    timestamp?: number;
    linkText?: string;
  }>;
  handleEditorChangeDebounced: (editor: Editor, view: MarkdownView) => void;
  saveSettings: () => Promise<void>;
}

export const DEFAULT_SETTINGS: AutoLinkSettings = {
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

export interface NoteMatch {
  title: string;
  file: TFile;
  isAlias: boolean;
}
