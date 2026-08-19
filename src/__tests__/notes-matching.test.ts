import { describe, it, expect } from "vitest";
import type { TFile } from "obsidian";
import type { AutoLinkSettings, AutoLinkPluginContext } from "../types";
import { findMatches, getRelevantFiles } from "../notes";
import { makePluginContext, type FakeFile } from "./helpers";

describe("findMatches", () => {
  describe("basic prefix matching", () => {
    it("returns notes whose title starts with the typed text", () => {
      const plugin = makePluginContext({}, [
        { basename: "Note" },
        { basename: "Notebook" },
        { basename: "Other" },
      ]);
      const matches = findMatches(plugin, "Note", "Current");
      const titles = matches.map((m) => m.title).sort();
      expect(titles).toEqual(["Note", "Notebook"]);
    });

    it("excludes the current note from matches", () => {
      const plugin = makePluginContext({}, [
        { basename: "Note" },
        { basename: "Current" },
      ]);
      const matches = findMatches(plugin, "Note", "Current");
      expect(matches.map((m) => m.title)).toEqual(["Note"]);
    });

    it("returns nothing when the typed text is the current note's title", () => {
      const plugin = makePluginContext(
        {},
        [{ basename: "Note" }, { basename: "Current" }],
      );
      expect(findMatches(plugin, "Current", "Current")).toEqual([]);
    });

    it("returns an empty array when nothing matches", () => {
      const plugin = makePluginContext({}, [{ basename: "Note" }]);
      expect(findMatches(plugin, "Zzz", "Current")).toEqual([]);
    });
  });

  describe("case sensitivity", () => {
    it("is case-insensitive by default", () => {
      const plugin = makePluginContext({}, [{ basename: "Note" }]);
      const matches = findMatches(plugin, "note", "Current");
      expect(matches.map((m) => m.title)).toEqual(["Note"]);
    });

    it("respects caseSensitive setting", () => {
      const plugin = makePluginContext({ caseSensitive: true }, [
        { basename: "Note" },
      ]);
      expect(findMatches(plugin, "note", "Current")).toEqual([]);
      expect(findMatches(plugin, "Note", "Current").length).toBe(1);
    });
  });

  describe("alias matching", () => {
    function pluginWithAlias() {
      const plugin = makePluginContext({}, [{ basename: "Real Title" }]);
      const key = "rt"
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/ß/g, "ss")
        .toLowerCase();
      plugin.aliases.set(key, {
        basename: "Real Title",
        path: "Real Title.md",
        extension: "md",
        parent: null,
      } as unknown as TFile);
      return plugin;
    }

    it("matches against aliases", () => {
      const plugin = pluginWithAlias();
      const matches = findMatches(plugin, "rt", "Something Else");
      expect(matches.length).toBe(1);
      expect(matches[0].isAlias).toBe(true);
      expect(matches[0].title).toBe("rt");
    });

    it("does not duplicate a note matched by both title and alias", () => {
      const plugin = pluginWithAlias();
      // "real title" prefix matches the note title too
      const matches = findMatches(plugin, "real", "Something Else");
      const uniqueFiles = new Set(matches.map((m) => m.file));
      expect(uniqueFiles.size).toBe(matches.length);
    });
  });

  describe("maxSuggestions cap", () => {
    it("limits results to maxSuggestions", () => {
      const notes = Array.from({ length: 10 }, (_, i) => ({
        basename: `Shared ${i}`,
      }));
      const plugin = makePluginContext({ maxSuggestions: 3 }, notes);
      const matches = findMatches(plugin, "Shared", "Current");
      expect(matches.length).toBe(3);
    });
  });
});

describe("getRelevantFiles", () => {
  const folderObj = { id: "folder" };
  const allFiles: FakeFile[] = [
    {
      basename: "Root",
      path: "Root.md",
      parent: { id: "root" },
      extension: "md",
    },
    {
      basename: "Sub",
      path: "Folder/Sub.md",
      parent: folderObj,
      extension: "md",
    },
  ];

  function pluginWithVault(overrides: Partial<AutoLinkSettings> = {}) {
    const plugin = makePluginContext(overrides);
    plugin.app = {
      vault: { getMarkdownFiles: () => allFiles },
      workspace: { getActiveFile: () => null },
    } as unknown as AutoLinkPluginContext["app"];
    return plugin;
  }

  it("returns all files in autonomous mode", () => {
    const plugin = pluginWithVault({ mode: "autonomous" });
    expect(getRelevantFiles(plugin)).toEqual(allFiles);
  });

  it("filters to the active folder in semiAutonomous mode", () => {
    const plugin = pluginWithVault({ mode: "semiAutonomous" });
    plugin.app.workspace = {
      getActiveFile: () => ({ parent: folderObj }),
    } as unknown as AutoLinkPluginContext["app"]["workspace"];
    const result = getRelevantFiles(plugin);
    expect(result).toEqual([allFiles[1]]);
  });

  it("falls back to all files when no active file in semiAutonomous", () => {
    const plugin = pluginWithVault({ mode: "semiAutonomous" });
    expect(getRelevantFiles(plugin)).toEqual(allFiles);
  });

  it("filters to customFolders in custom mode", () => {
    const plugin = pluginWithVault({
      mode: "custom",
      customFolders: ["Folder"],
    });
    const result = getRelevantFiles(plugin);
    expect(result).toEqual([allFiles[1]]);
  });

  it("treats '/' as vault root in custom mode", () => {
    const plugin = pluginWithVault({ mode: "custom", customFolders: ["/"] });
    expect(getRelevantFiles(plugin)).toEqual(allFiles);
  });
});
