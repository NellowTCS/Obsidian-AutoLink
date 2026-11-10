import type { Editor, TFile } from "obsidian";
import type { AutoLinkPluginContext, NoteMatch } from "./types";

const WIKILINK_RE =
  /\[\[([^[\]|#\r\n]+)(?:#[^[\]|\r\n]*)?(?:\|[^\]\r\n]*)?\]\]/g;
const HEADING_RE = /^ {0,3}#{1,6}(?:[\t ]|$)/;
const FENCE_RE = /^ {0,3}(`{3,}|~{3,})(.*)$/;

/** Line range with an inclusive start and exclusive end. */
export interface SectionBounds {
  start: number;
  end: number;
}

function frontmatterEnd(lines: string[]): number {
  if (lines[0]?.trim() !== "---") return 0;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === "---" || line === "...") return i + 1;
  }

  return 0;
}

function normalizeLinkpath(linkpath: string): string {
  const path = linkpath.trim().replace(/\.md$/i, "");
  return (path.split("/").pop() ?? path).toLowerCase();
}

function isEscaped(text: string, offset: number): boolean {
  let backslashes = 0;
  for (let i = offset - 1; i >= 0 && text[i] === "\\"; i--) backslashes++;
  return backslashes % 2 === 1;
}

function countLinksByBasename(
  lines: string[],
  start: number,
  end: number,
): Map<string, number> {
  const counts = new Map<string, number>();
  const linkPattern = new RegExp(WIKILINK_RE);

  for (let i = start; i < end; i++) {
    const line = lines[i];
    linkPattern.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = linkPattern.exec(line)) !== null) {
      const embedOffset = match.index - 1;
      if (
        embedOffset >= 0 &&
        line[embedOffset] === "!" &&
        !isEscaped(line, embedOffset)
      )
        continue;
      if (isEscaped(line, match.index)) continue;

      const basename = normalizeLinkpath(match[1]);
      counts.set(basename, (counts.get(basename) ?? 0) + 1);
    }
  }

  return counts;
}

function getEditorLinkCounts(
  plugin: AutoLinkPluginContext,
  editor: Editor,
): Map<string, number> {
  const lines = editor.getValue().split("\n");
  const { start, end } =
    plugin.settings.maxLinksScope === "section"
      ? getSectionBounds(lines, editor.getCursor().line)
      : { start: 0, end: lines.length };

  return countLinksByBasename(lines, start, end);
}

export function getSectionBounds(
  lines: string[],
  lineNo: number,
): SectionBounds {
  let start = 0;
  let end = lines.length;
  let fence: string | null = null;

  for (let i = frontmatterEnd(lines); i < lines.length; i++) {
    const line = lines[i];
    const fenceMatch = line.match(FENCE_RE);

    if (fence !== null) {
      if (
        fenceMatch &&
        fenceMatch[1][0] === fence[0] &&
        fenceMatch[1].length >= fence.length &&
        fenceMatch[2].trim() === ""
      ) {
        fence = null;
      }
      continue;
    }

    if (
      fenceMatch &&
      (fenceMatch[1][0] !== "`" || !fenceMatch[2].includes("`"))
    ) {
      fence = fenceMatch[1];
      continue;
    }

    if (!HEADING_RE.test(line)) continue;
    if (i <= lineNo) {
      start = i;
    } else {
      end = i;
      break;
    }
  }

  return { start, end };
}

export function countLinksTo(
  lines: string[],
  target: Pick<TFile, "basename">,
  start: number = 0,
  end: number = lines.length,
): number {
  return (
    countLinksByBasename(lines, start, end).get(
      target.basename.toLowerCase(),
    ) ?? 0
  );
}

export function isUnderLinkLimit(
  plugin: AutoLinkPluginContext,
  editor: Editor,
  target: TFile,
): boolean {
  const max = plugin.settings.maxLinksPerNote;
  if (max <= 0) return true;

  const counts = getEditorLinkCounts(plugin, editor);
  return (counts.get(target.basename.toLowerCase()) ?? 0) < max;
}

export function filterMatchesUnderLinkLimit(
  plugin: AutoLinkPluginContext,
  editor: Editor,
  matches: NoteMatch[],
): NoteMatch[] {
  const max = plugin.settings.maxLinksPerNote;
  if (max <= 0 || matches.length === 0) return matches;

  const counts = getEditorLinkCounts(plugin, editor);
  return matches.filter(
    (match) => (counts.get(match.file.basename.toLowerCase()) ?? 0) < max,
  );
}
