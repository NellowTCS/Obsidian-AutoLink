import { describe, it, expect } from "vitest";
import { isInsideLink, getBestMatch, escapeRegex } from "../editor";
import { makePluginContext } from "./helpers";

describe("isInsideLink", () => {
  it("detects cursor inside an open wikilink", () => {
    expect(isInsideLink("See [[Note", 9)).toBe(true);
  });

  it("returns false after the wikilink is closed", () => {
    expect(isInsideLink("See [[Note]]", 12)).toBe(false);
  });

  it("returns false in plain text with no brackets", () => {
    expect(isInsideLink("Just typing words", 10)).toBe(false);
  });

  it("does not flag a single-bracket markdown link", () => {
    expect(isInsideLink("a [link", 8)).toBe(false);
  });

  it("returns false after a closed markdown link", () => {
    expect(isInsideLink("a [link](http://x)", 17)).toBe(false);
  });

  it("handles multiple wikilinks correctly", () => {
    expect(isInsideLink("[[A]] and [[B", 14)).toBe(true);
    expect(isInsideLink("[[A]] and [[B]]", 16)).toBe(false);
  });
});

describe("escapeRegex", () => {
  it("escapes regex metacharacters", () => {
    expect(escapeRegex("a.b*c")).toBe("a\\.b\\*c");
  });

  it("escapes brackets and pipes", () => {
    expect(escapeRegex("file[0] (note) | x")).toBe(
      "file\\[0\\] \\(note\\) \\| x",
    );
  });

  it("leaves plain words untouched", () => {
    expect(escapeRegex("Note")).toBe("Note");
  });
});

describe("getBestMatch", () => {
  it("returns the full phrase when it matches a note", () => {
    const plugin = makePluginContext({}, [{ basename: "Hello World" }]);
    const result = getBestMatch(plugin, "Hello World", "Current");
    expect(result.term).toBe("Hello World");
    expect(result.matches.length).toBe(1);
  });

  it("falls back to the last word when the full phrase does not match", () => {
    const plugin = makePluginContext({}, [{ basename: "World" }]);
    const result = getBestMatch(plugin, "Hello World", "Current");
    expect(result.term).toBe("World");
    expect(result.matches.length).toBe(1);
  });

  it("returns no matches when nothing matches", () => {
    const plugin = makePluginContext({}, [{ basename: "Note" }]);
    const result = getBestMatch(plugin, "Hello World", "Current");
    expect(result.matches).toEqual([]);
  });

  it("ignores the current note", () => {
    const plugin = makePluginContext({}, [{ basename: "Current" }]);
    const result = getBestMatch(plugin, "Current", "Current");
    expect(result.matches).toEqual([]);
  });

  it("respects minWordLength for candidate trimming", () => {
    const plugin = makePluginContext({ minWordLength: 5 }, [
      { basename: "World" },
    ]);
    // "World" is 5 chars, meets minWordLength, should match
    const result = getBestMatch(plugin, "Hello World", "Current");
    expect(result.term).toBe("World");
  });
});
