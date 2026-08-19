import type { AutoLinkPluginContext, AutoLinkSettings } from "../types";
import { DEFAULT_SETTINGS } from "../types";
import type { TFile } from "obsidian";

export interface FakeFile {
  basename: string;
  path: string;
  extension: string;
  parent?: unknown;
}

export type FakeNote = { basename: string; path?: string };

export function makePluginContext(
  overrides: Partial<AutoLinkSettings> = {},
  notes: FakeNote[] = [],
): AutoLinkPluginContext {
  const settings: AutoLinkSettings = { ...DEFAULT_SETTINGS, ...overrides };

  const noteTitles = new Map<string, TFile>();
  const aliases = new Map<string, TFile>();

  for (const note of notes) {
    const path = note.path ?? `${note.basename}.md`;
    const file: FakeFile = { basename: note.basename, path, extension: "md" };
    const key = settings.caseSensitive
      ? note.basename
      : note.basename
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, "")
          .replace(/ß/g, "ss")
          .toLowerCase();
    noteTitles.set(key, file as unknown as TFile);
  }

  return {
    app: {} as AutoLinkPluginContext["app"],
    noteTitles,
    aliases,
    settings,
    pendingMatches: new Map(),
    isAutoLinkDisabled: false,
    disableTimeout: null,
    undoStack: [],
    handleEditorChangeDebounced: () => {},
    saveSettings: async () => {},
  };
}
