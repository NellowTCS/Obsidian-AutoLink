import { describe, it, expect, vi } from "vitest";
import type {
  App,
  Editor,
  EditorSuggestContext,
  Instruction,
  TFile,
} from "obsidian";
import type { AutoLinkSettings } from "../types";
import type AutoLinkPlugin from "../main";
import { AutoLinkEditorSuggest } from "../popup";
import { makePluginContext, type FakeNote } from "./helpers";
import { makeEditor } from "./editor-fixture";

// Obsidian provides this DOM-dependent base class inside the host application
vi.mock("obsidian", () => ({
  EditorSuggest: class {
    app: App;
    context: EditorSuggestContext | null = null;

    constructor(app: App) {
      this.app = app;
    }

    setInstructions(_instructions: Instruction[]): void {}

    close(): void {
      this.context = null;
    }
  },
}));

function makePopup(
  overrides: Partial<AutoLinkSettings> = {},
  notes: FakeNote[] = [{ basename: "Apple" }],
) {
  const plugin = makePluginContext({ mode: "suggestions", ...overrides }, [
    { basename: "Current" },
    ...notes,
  ]);
  const file = plugin.noteTitles.get("current");
  if (!file) throw new Error("The suggestion fixture must include Current.md");

  // The mocked base class does not access App.
  plugin.app = {
    workspace: { getActiveFile: () => file },
  } as App;

  const popup = new AutoLinkEditorSuggest(plugin.app, plugin as AutoLinkPlugin);
  return { plugin, popup, file };
}

function suggestionContext(
  editor: Editor,
  file: TFile,
  query: string = "Apple",
): EditorSuggestContext {
  const end = editor.getCursor();
  return {
    editor,
    file,
    start: { line: end.line, ch: end.ch - query.length },
    end,
    query,
  };
}

describe("AutoLinkEditorSuggest link limits", () => {
  it("does not open when every matching note has reached its limit", () => {
    const { popup, file } = makePopup();
    const editor = makeEditor("[[Apple]]\nApple");

    expect(popup.onTrigger(editor.getCursor(), editor, file)).toBeNull();
  });

  it("opens when the matching note remains under its limit", () => {
    const { popup, file } = makePopup();
    const editor = makeEditor("Apple");

    expect(popup.onTrigger(editor.getCursor(), editor, file)).toEqual({
      start: { line: 0, ch: 0 },
      end: { line: 0, ch: 5 },
      query: "Apple",
    });
  });

  it("omits capped notes while preserving available prefix matches", () => {
    const { popup, file } = makePopup({}, [
      { basename: "Apple" },
      { basename: "Apple Pie" },
    ]);
    const editor = makeEditor("[[Apple]]\nApple");

    const suggestions = popup.getSuggestions(suggestionContext(editor, file));

    expect(suggestions.map((match) => match.file.basename)).toEqual([
      "Apple Pie",
    ]);
    expect(popup.onTrigger(editor.getCursor(), editor, file)).not.toBeNull();
  });

  it("applies the suggestion cap after removing capped notes", () => {
    const { popup, file } = makePopup({ minWordLength: 2, maxSuggestions: 1 }, [
      { basename: "Apple" },
      { basename: "Apricot" },
    ]);
    const editor = makeEditor("[[Apple]]\nAp");

    const suggestions = popup.getSuggestions(
      suggestionContext(editor, file, "Ap"),
    );

    expect(suggestions.map((match) => match.file.basename)).toEqual([
      "Apricot",
    ]);
    expect(popup.onTrigger(editor.getCursor(), editor, file)).not.toBeNull();
  });

  it("keeps custom-mode prefix ambiguity after filtering a capped match", () => {
    const { popup, file } = makePopup({ mode: "custom", minWordLength: 2 }, [
      { basename: "Apple" },
      { basename: "Apricot" },
    ]);
    const editor = makeEditor("[[Apple]]\nAp");

    expect(popup.onTrigger(editor.getCursor(), editor, file)).not.toBeNull();
    expect(
      popup
        .getSuggestions(suggestionContext(editor, file, "Ap"))
        .map((match) => match.file.basename),
    ).toEqual(["Apricot"]);
  });

  it("allows repeated suggestions with an unlimited cap", () => {
    const { popup, file } = makePopup({ maxLinksPerNote: 0 });
    const editor = makeEditor("[[Apple]]\nApple");

    expect(popup.onTrigger(editor.getCursor(), editor, file)).not.toBeNull();
    expect(
      popup
        .getSuggestions(suggestionContext(editor, file))
        .map((match) => match.file.basename),
    ).toEqual(["Apple"]);
  });

  it("counts suggestions only in the current heading section", () => {
    const { popup, file } = makePopup({ maxLinksScope: "section" });
    const editor = makeEditor(
      "## Ingredients\n[[Apple]]\n## Instructions\nApple",
    );

    expect(
      popup
        .getSuggestions(suggestionContext(editor, file))
        .map((match) => match.file.basename),
    ).toEqual(["Apple"]);

    editor.setValue("## Ingredients\n[[Apple]]\nApple");
    editor.setCursor({ line: 2, ch: 5 });

    expect(popup.getSuggestions(suggestionContext(editor, file))).toEqual([]);
  });

  it("rechecks a selection after another link is added to the live text", () => {
    const { plugin, popup, file } = makePopup();
    const editor = makeEditor("\nApple");
    const context = suggestionContext(editor, file);
    const match = popup.getSuggestions(context)[0];
    if (!match)
      throw new Error("Apple must initially be available as a suggestion");
    popup.context = context;

    editor.setLine(0, "[[Apple]]");
    // selectSuggestion ignores the host event; Node supplies Event but not KeyboardEvent.
    popup.selectSuggestion(match, new Event("keydown") as KeyboardEvent);

    expect(editor.getValue()).toBe("[[Apple]]\nApple");
    expect(plugin.undoStack).toHaveLength(0);
  });

  it("uses the suggestion context file rather than another active pane", () => {
    const { plugin, popup, file } = makePopup();
    const apple = plugin.noteTitles.get("apple");
    if (!apple) throw new Error("The suggestion fixture must include Apple.md");
    plugin.app.workspace.getActiveFile = () => apple;
    const editor = makeEditor("Apple");

    expect(
      popup
        .getSuggestions(suggestionContext(editor, file))
        .map((match) => match.file.basename),
    ).toEqual(["Apple"]);
  });

  it("reads the live note once when filtering multiple suggestions", () => {
    const { popup, file } = makePopup({}, [
      { basename: "Apple" },
      { basename: "Apple Pie" },
      { basename: "Apple Sauce" },
    ]);
    const editor = makeEditor("Apple");
    const readText = vi.spyOn(editor, "getValue");

    const suggestions = popup.getSuggestions(suggestionContext(editor, file));

    expect(suggestions).toHaveLength(3);
    expect(readText).toHaveBeenCalledTimes(1);
  });
});
