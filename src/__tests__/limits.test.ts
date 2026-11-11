import { describe, it, expect } from "vitest";
import { countLinksTo, getSectionBounds } from "../limits";

const APPLE = { basename: "Apple" };

describe("countLinksTo", () => {
  it("counts adjacent links and all supported target forms", () => {
    const lines = [
      "[[Apple]][[Apple|fruit]]",
      "[[Apple#Color]] [[Apple#^nutrition|fruit]]",
      "[[Fruits/Apple]] [[APPLE.md]] [[apple]]",
      "![[Apple]] [[Banana]]",
    ];

    expect(countLinksTo(lines, APPLE)).toBe(7);
  });

  it("counts only the requested line range", () => {
    const lines = ["[[Apple]]", "[[Apple]][[Apple]]", "[[Apple]]"];

    expect(countLinksTo(lines, APPLE, 1, 2)).toBe(2);
  });

  it("does not include other notes sharing a title prefix", () => {
    expect(countLinksTo(["[[Apple Pie]] [[Pineapple]]"], APPLE)).toBe(0);
  });

  it("counts links to multiword note titles", () => {
    expect(countLinksTo(["[[Apple Pie]]"], { basename: "Apple Pie" })).toBe(1);
  });

  it("counts links whose display alias contains an opening bracket", () => {
    expect(countLinksTo(["[[Apple|[fruit]]"], APPLE)).toBe(1);
  });

  it("matches the existing basename-based insertion for folder paths", () => {
    expect(countLinksTo(["[[Fruits/Apple]] [[Recipes/Apple]]"], APPLE)).toBe(2);
  });

  it("ignores incomplete or nested wikilinks", () => {
    expect(
      countLinksTo(["[[Apple", "[[Apple|fruit", "[[Apple[fruit]]"], APPLE),
    ).toBe(0);
  });

  it("does not retain regex state between calls", () => {
    const lines = ["[[Apple]] [[Apple]]"];

    expect(countLinksTo(lines, APPLE)).toBe(2);
    expect(countLinksTo(lines, APPLE)).toBe(2);
  });

  it("returns zero for an empty note", () => {
    expect(countLinksTo([], APPLE)).toBe(0);
  });

  it("does not count an escaped opening bracket as a wikilink", () => {
    expect(countLinksTo(["\\[[Apple]] [[Apple]]"], APPLE)).toBe(1);
  });

  it("counts a wikilink following an escaped backslash", () => {
    expect(countLinksTo(["\\\\[[Apple]]"], APPLE)).toBe(1);
  });

  it("counts a wikilink after an escaped embed marker", () => {
    expect(countLinksTo(["\\![[Apple]]"], APPLE)).toBe(1);
  });
});

describe("getSectionBounds", () => {
  const lines = [
    "Preamble",
    "# Recipe",
    "Overview",
    "## Ingredients",
    "Apples",
    "### Preparation",
    "Peel",
    "## Instructions",
    "Bake",
  ];

  it.each([
    { line: 0, expected: { start: 0, end: 1 } },
    { line: 1, expected: { start: 1, end: 3 } },
    { line: 4, expected: { start: 3, end: 5 } },
    { line: 5, expected: { start: 5, end: 7 } },
    { line: 8, expected: { start: 7, end: 9 } },
  ])("finds the section around cursor line $line", ({ line, expected }) => {
    expect(getSectionBounds(lines, line)).toEqual(expected);
  });

  it("uses the whole note when there are no headings", () => {
    expect(getSectionBounds(["Apple", "Pie"], 1)).toEqual({ start: 0, end: 2 });
  });

  it("returns an empty range for an empty note", () => {
    expect(getSectionBounds([], 0)).toEqual({ start: 0, end: 0 });
  });

  it.each(["---", "..."])(
    "ignores YAML comments before the %s delimiter",
    (delimiter) => {
      const note = [
        "---",
        "# YAML comment",
        "title: Recipe",
        delimiter,
        "Body",
        "## Recipe",
      ];

      expect(getSectionBounds(note, 4)).toEqual({ start: 0, end: 5 });
    },
  );

  it("treats an unmatched leading rule as Markdown rather than frontmatter", () => {
    expect(
      getSectionBounds(
        ["---", "# Recipe", "Body", "## Ingredients", "Apples"],
        4,
      ),
    ).toEqual({ start: 3, end: 5 });
  });

  it("ignores fenced headings until the same marker closes the block", () => {
    const note = [
      "## Ingredients",
      "````markdown",
      "```",
      "### Inside the fence",
      "~~~",
      "# Also inside",
      "````",
      "Apples",
      "## Instructions",
    ];

    expect(getSectionBounds(note, 7)).toEqual({ start: 0, end: 8 });
  });

  it("does not close a fence when the marker has trailing text", () => {
    const note = [
      "~~~md",
      "~~~not closed",
      "## Example",
      "~~~",
      "## Recipe",
      "Body",
    ];

    expect(getSectionBounds(note, 2)).toEqual({ start: 0, end: 4 });
  });

  it("accepts headings indented by at most three spaces", () => {
    const note = [
      "# Recipe",
      "    ## Code",
      "Body",
      "   ## Ingredients",
      "Apples",
    ];

    expect(getSectionBounds(note, 2)).toEqual({ start: 0, end: 3 });
    expect(getSectionBounds(note, 4)).toEqual({ start: 3, end: 5 });
  });

  it("does not treat tags or seven hash marks as headings", () => {
    const note = [
      "# Recipe",
      "#tag",
      "####### Not a heading",
      "Body",
      "## Instructions",
    ];

    expect(getSectionBounds(note, 3)).toEqual({ start: 0, end: 4 });
  });
});
