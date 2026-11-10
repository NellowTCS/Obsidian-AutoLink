import { describe, it, expect } from "vitest";
import type { Editor } from "obsidian";
import type { AutoLinkPluginContext, NoteMatch } from "../types";
import {
  acceptSuggestion,
  handleAutonomousMode,
  handleEditorChange,
  insertLinkForCompletedWord,
  undoLastAutolink,
} from "../editor";
import { findMatches } from "../notes";
import { makePluginContext } from "./helpers";
import { makeEditor, makeMarkdownView } from "./editor-fixture";

const APPLE_NOTE = { basename: "Apple", path: "Fruits/Apple.md" };

function getAppleMatch(plugin: AutoLinkPluginContext): NoteMatch {
  const match = findMatches(plugin, "Apple", "Current")[0];
  if (!match) throw new Error("The Apple fixture must match its note title");
  return match;
}

const insertionPaths = [
  {
    name: "completed-word insertion",
    insert: (
      plugin: AutoLinkPluginContext,
      editor: Editor,
      match: NoteMatch,
    ) => {
      editor.setLine(editor.getCursor().line, "Apple ");
      editor.setCursor({ line: editor.getCursor().line, ch: 6 });
      insertLinkForCompletedWord(plugin, editor, "Apple", match, 5);
    },
    plain: "Apple ",
    linked: "[[Apple]] ",
  },
  {
    name: "custom single-match insertion",
    insert: (
      plugin: AutoLinkPluginContext,
      editor: Editor,
      match: NoteMatch,
    ) => {
      handleAutonomousMode(
        plugin,
        editor,
        "Apple",
        [match],
        editor.getCursor(),
      );
    },
    plain: "Apple",
    linked: "[[Apple]]",
  },
  {
    name: "suggestion acceptance",
    insert: (
      plugin: AutoLinkPluginContext,
      editor: Editor,
      match: NoteMatch,
    ) => {
      acceptSuggestion(plugin, editor, match, "Apple");
    },
    plain: "Apple",
    linked: "[[Apple]]",
  },
];

describe.each(insertionPaths)(
  "link limits for $name",
  ({ insert, plain, linked }) => {
    it("leaves a repeated target unchanged with the default limit", () => {
      const plugin = makePluginContext({}, [APPLE_NOTE]);
      const editor = makeEditor("[[Apple]]\nApple");
      const match = getAppleMatch(plugin);

      insert(plugin, editor, match);

      expect(editor.getValue()).toBe(`[[Apple]]\n${plain}`);
      expect(plugin.undoStack).toHaveLength(0);
    });

    it("allows another target to be linked", () => {
      const plugin = makePluginContext({}, [APPLE_NOTE]);
      const editor = makeEditor("[[Banana]]\nApple");

      insert(plugin, editor, getAppleMatch(plugin));

      expect(editor.getValue()).toBe(`[[Banana]]\n${linked}`);
      expect(plugin.undoStack).toHaveLength(1);
    });

    it("allows repeated links when the limit is zero", () => {
      const plugin = makePluginContext({ maxLinksPerNote: 0 }, [APPLE_NOTE]);
      const editor = makeEditor("[[Apple]] [[Apple]]\nApple");

      insert(plugin, editor, getAppleMatch(plugin));

      expect(editor.getValue()).toBe(`[[Apple]] [[Apple]]\n${linked}`);
    });

    it("allows links below a configured limit", () => {
      const plugin = makePluginContext({ maxLinksPerNote: 2 }, [APPLE_NOTE]);
      const editor = makeEditor("[[Apple]]\nApple");

      insert(plugin, editor, getAppleMatch(plugin));

      expect(editor.getValue()).toBe(`[[Apple]]\n${linked}`);
    });

    it("blocks links when a configured limit is reached", () => {
      const plugin = makePluginContext({ maxLinksPerNote: 2 }, [APPLE_NOTE]);
      const editor = makeEditor("[[Apple]] [[Apple]]\nApple");

      insert(plugin, editor, getAppleMatch(plugin));

      expect(editor.getValue()).toBe(`[[Apple]] [[Apple]]\n${plain}`);
    });

    it("allows the same target in a different heading section", () => {
      const plugin = makePluginContext({ maxLinksScope: "section" }, [
        APPLE_NOTE,
      ]);
      const editor = makeEditor(
        "## Ingredients\n[[Apple]]\n## Instructions\nApple",
      );

      insert(plugin, editor, getAppleMatch(plugin));

      expect(editor.getValue()).toBe(
        `## Ingredients\n[[Apple]]\n## Instructions\n${linked}`,
      );
    });

    it("blocks the same target within the current heading section", () => {
      const plugin = makePluginContext({ maxLinksScope: "section" }, [
        APPLE_NOTE,
      ]);
      const editor = makeEditor(
        "## Ingredients\n[[Apple]]\nApple\n## Instructions",
      );
      editor.setCursor({ line: 2, ch: 5 });

      insert(plugin, editor, getAppleMatch(plugin));

      expect(editor.getValue()).toBe(
        `## Ingredients\n[[Apple]]\n${plain}\n## Instructions`,
      );
    });

    it("uses live text after an existing link is removed", () => {
      const plugin = makePluginContext({}, [APPLE_NOTE]);
      const editor = makeEditor("[[Apple]]\nApple");
      const match = getAppleMatch(plugin);

      insert(plugin, editor, match);
      expect(editor.getValue()).toBe(`[[Apple]]\n${plain}`);
      editor.setLine(0, "Apple");
      insert(plugin, editor, match);

      expect(editor.getValue()).toBe(`Apple\n${linked}`);
      expect(plugin.undoStack).toHaveLength(1);
    });
  },
);

describe("link limits in the editor-change handler", () => {
  it.each(["autonomous", "semiAutonomous", "custom"] as const)(
    "blocks repeated links in %s mode",
    (mode) => {
      const plugin = makePluginContext({ mode }, [APPLE_NOTE]);
      const typed = mode === "custom" ? "Apple" : "Apple ";
      const editor = makeEditor(`[[Apple]]\n${typed}`);

      handleEditorChange(plugin, editor, makeMarkdownView(editor));

      expect(editor.getValue()).toBe(`[[Apple]]\n${typed}`);
      expect(plugin.undoStack).toHaveLength(0);
    },
  );

  it.each([
    "[[Apple|fruit]]",
    "[[Apple#Color]]",
    "[[Apple#^nutrition]]",
    "[[Fruits/Apple]]",
    "[[Fruits/apple.MD|fruit]]",
  ])("counts the existing link %s toward the default limit", (existingLink) => {
    const plugin = makePluginContext({}, [APPLE_NOTE]);
    const editor = makeEditor(`${existingLink}\nApple `);

    handleEditorChange(plugin, editor, makeMarkdownView(editor));

    expect(editor.getValue()).toBe(`${existingLink}\nApple `);
  });

  it("does not count an embed toward the link limit", () => {
    const plugin = makePluginContext({}, [APPLE_NOTE]);
    const editor = makeEditor("![[Apple]]\nApple ");

    handleEditorChange(plugin, editor, makeMarkdownView(editor));

    expect(editor.getValue()).toBe("![[Apple]]\n[[Apple]] ");
  });

  it("counts links below the cursor without moving them", () => {
    const plugin = makePluginContext({}, [APPLE_NOTE]);
    const editor = makeEditor("Apple \n[[Apple]]", { line: 0, ch: 6 });

    handleEditorChange(plugin, editor, makeMarkdownView(editor));

    expect(editor.getValue()).toBe("Apple \n[[Apple]]");
  });

  it("does not treat a heading inside a fenced block as a new section", () => {
    const plugin = makePluginContext({ maxLinksScope: "section" }, [
      APPLE_NOTE,
    ]);
    const editor = makeEditor("[[Apple]]\n```md\n## Example\n```\nApple ");

    handleEditorChange(plugin, editor, makeMarkdownView(editor));

    expect(editor.getValue()).toBe("[[Apple]]\n```md\n## Example\n```\nApple ");
  });

  it("waits for the full title even when a shorter matching note is capped", () => {
    const plugin = makePluginContext({}, [
      { basename: "Note" },
      { basename: "Note with Space" },
    ]);
    const editor = makeEditor("[[Note]]\nNote ");

    handleEditorChange(plugin, editor, makeMarkdownView(editor));
    expect(editor.getValue()).toBe("[[Note]]\nNote ");

    editor.setLine(1, "Note with Space ");
    editor.setCursor({ line: 1, ch: 16 });
    handleEditorChange(plugin, editor, makeMarkdownView(editor));

    expect(editor.getValue()).toBe("[[Note]]\n[[Note with Space]] ");
  });

  it("allows linking again after an auto-link is undone", () => {
    const plugin = makePluginContext({}, [APPLE_NOTE]);
    const editor = makeEditor("Apple ");
    const view = makeMarkdownView(editor);

    handleEditorChange(plugin, editor, view);
    expect(editor.getValue()).toBe("[[Apple]] ");
    expect(undoLastAutolink(plugin, editor)).toBe(true);
    expect(editor.getValue()).toBe("Apple ");

    handleEditorChange(plugin, editor, view);

    expect(editor.getValue()).toBe("[[Apple]] ");
    expect(plugin.undoStack).toHaveLength(1);
  });
});
