import type { TFile } from "obsidian";
import type { AutoLinkSettings, NoteMatch } from "./types";

export function updateNoteList(plugin: any) {
  plugin.noteTitles.clear();
  plugin.aliases.clear();

  const files = getRelevantFiles(plugin);

  files.forEach((file: TFile) => {
    const basename = file.basename;
    plugin.noteTitles.set(
      plugin.settings.caseSensitive ? basename : basename.toLowerCase(),
      file,
    );

    if (plugin.settings.includeAliases) {
      const cache = plugin.app.metadataCache.getFileCache(file);
      if (cache?.frontmatter?.aliases) {
        const aliases = Array.isArray(cache.frontmatter.aliases)
          ? cache.frontmatter.aliases
          : [cache.frontmatter.aliases];

        aliases.forEach((alias: string) => {
          if (typeof alias === "string" && alias.trim()) {
            const key = plugin.settings.caseSensitive
              ? alias
              : alias.toLowerCase();
            plugin.aliases.set(key, file);
          }
        });
      }
    }
  });
}

export function getRelevantFiles(plugin: any): TFile[] {
  const allFiles = plugin.app.vault.getMarkdownFiles();

  if (plugin.settings.mode === "semiAutonomous") {
    const activeFile = plugin.app.workspace.getActiveFile();
    if (!activeFile) return allFiles;

    const activeFolder = activeFile.parent;
    return allFiles.filter((file: TFile) => file.parent === activeFolder);
  }

  if (
    plugin.settings.mode === "custom" &&
    plugin.settings.customFolders.length > 0
  ) {
    return allFiles.filter((file: TFile) => {
      return plugin.settings.customFolders.some((folder: string) =>
        file.path.startsWith(folder === "/" ? "" : folder + "/"),
      );
    });
  }

  return allFiles;
}

export function findMatches(
  plugin: any,
  typed: string,
  currentBasename: string,
): NoteMatch[] {
  const searchKey = plugin.settings.caseSensitive ? typed : typed.toLowerCase();
  const matches: NoteMatch[] = [];

  for (const [title, file] of plugin.noteTitles.entries()) {
    if (
      title !==
        (plugin.settings.caseSensitive
          ? currentBasename
          : currentBasename.toLowerCase()) &&
      title.startsWith(searchKey)
    ) {
      matches.push({ title: file.basename, file, isAlias: false });
    }
  }

  for (const [alias, file] of plugin.aliases.entries()) {
    if (file.basename !== currentBasename && alias.startsWith(searchKey)) {
      if (!matches.find((m) => m.file === file)) {
        matches.push({ title: alias, file, isAlias: true });
      }
    }
  }

  return matches.slice(0, plugin.settings.maxSuggestions);
}
