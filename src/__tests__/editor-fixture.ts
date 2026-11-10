import type { Editor, EditorPosition, MarkdownView, TFile } from "obsidian";

export function makeEditor(content: string, position?: EditorPosition): Editor {
  let lines = content.split("\n");
  let cursor = position ?? {
    line: lines.length - 1,
    ch: lines[lines.length - 1].length,
  };

  function getLine(line: number): string {
    if (!Number.isInteger(line) || line < 0 || line >= lines.length) {
      throw new RangeError(`Editor line ${line} is outside the document`);
    }
    return lines[line];
  }

  function setCursor(pos: EditorPosition | number, ch?: number): void {
    const next = typeof pos === "number" ? { line: pos, ch: ch ?? 0 } : pos;
    const line = getLine(next.line);
    if (!Number.isInteger(next.ch) || next.ch < 0 || next.ch > line.length) {
      throw new RangeError(`Editor character ${next.ch} is outside the line`);
    }
    cursor = { ...next };
  }

  setCursor(cursor);

  const editor = {
    getValue: () => lines.join("\n"),
    setValue: (value: string) => {
      lines = value.split("\n");
      const line = Math.min(cursor.line, lines.length - 1);
      cursor = { line, ch: Math.min(cursor.ch, lines[line].length) };
    },
    getLine,
    setLine: (line: number, value: string) => {
      getLine(line);
      lines[line] = value;
    },
    getCursor: () => ({ ...cursor }),
    setCursor,
  };

  // Obsidian supplies Editor at runtime
  return editor as Editor;
}

export function makeMarkdownView(
  editor: Editor,
  file: TFile | null = null,
): MarkdownView {
  // handleEditorChange reads only file
  return { editor, file } as MarkdownView;
}
