import type { Editor, MarkdownView } from "obsidian";
import type { AutoLinkPluginContext, NoteMatch } from "./types";
import { findMatches } from "./notes";

export function isInsideLink(line: string, ch: number): boolean {
  const beforeCursor = line.slice(0, ch);
  const afterCursor = line.slice(ch);

  const openBrackets = (beforeCursor.match(/\[\[/g) || []).length;
  const closeBrackets = (beforeCursor.match(/\]\]/g) || []).length;
  if (openBrackets > closeBrackets) return true;

  const lastOpenBracket = beforeCursor.lastIndexOf("[");
  const lastCloseBracket = beforeCursor.lastIndexOf("]");
  if (lastOpenBracket > lastCloseBracket && afterCursor.includes("]("))
    return true;

  return false;
}

export function getBestMatch(
  plugin: AutoLinkPluginContext,
  text: string,
  currentBasename: string,
) {
  let candidate = text;
  const maxIterations = 10;
  let iterations = 0;

  while (candidate.length > 0 && iterations < maxIterations) {
    const trimmed = candidate.trim();
    if (trimmed.length >= plugin.settings.minWordLength) {
      const matches = findMatches(plugin, trimmed, currentBasename);
      if (matches.length > 0) {
        return { term: trimmed, matches };
      }
    }

    const spaceIndex = candidate.indexOf(" ");
    if (spaceIndex === -1) break;
    candidate = candidate.slice(spaceIndex + 1);
    iterations++;
  }

  const lastSpace = text.lastIndexOf(" ");
  if (lastSpace !== -1) {
    return { term: text.slice(lastSpace + 1).trim(), matches: [] };
  }

  return { term: text.trim(), matches: [] };
}

export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function insertLinkForCompletedWord(
  plugin: AutoLinkPluginContext,
  editor: Editor,
  completedWord: string,
  match: NoteMatch,
  delimiterPos: number,
  bulletPrefix: string = "",
) {
  const cursor = editor.getCursor();
  const line = editor.getLine(cursor.line);

  plugin.undoStack.push({
    line: cursor.line,
    original: line,
    cursor: { line: cursor.line, ch: cursor.ch },
    timestamp: Date.now(),
    linkText: match.file.basename,
  });

  const link = `[[${match.file.basename}${match.isAlias ? "|" + match.title : ""}]]`;

  const processedLine = line.slice(bulletPrefix.length);
  const beforeDelimiter = processedLine.slice(0, delimiterPos);
  const wordStart = Math.max(0, beforeDelimiter.length - completedWord.length);

  const newLine =
    bulletPrefix +
    processedLine.slice(0, wordStart) +
    link +
    processedLine.slice(delimiterPos);
  editor.setLine(cursor.line, newLine);

  const newCursorPos = bulletPrefix.length + wordStart + link.length + 1;
  editor.setCursor({
    line: cursor.line,
    ch: Math.min(newLine.length, newCursorPos),
  });

  if (plugin.undoStack.length > 10) plugin.undoStack.shift();
}

export function handleAutonomousMode(
  plugin: AutoLinkPluginContext,
  editor: Editor,
  typed: string,
  matches: NoteMatch[],
  cursor: { line: number; ch: number },
  bulletPrefix: string = "",
) {
  if (matches.length === 1) {
    const match = matches[0];
    const line = editor.getLine(cursor.line);

    plugin.undoStack.push({
      line: cursor.line,
      original: line,
      cursor: { line: cursor.line, ch: cursor.ch },
      timestamp: Date.now(),
      linkText: match.file.basename,
    });

    const link = `[[${match.file.basename}${match.isAlias ? "|" + match.title : ""}]]`;

    const processedLine = line.slice(bulletPrefix.length);
    const newProcessedLine = processedLine.replace(
      new RegExp(`${escapeRegex(typed)}$`),
      link,
    );
    const newLine = bulletPrefix + newProcessedLine;
    editor.setLine(cursor.line, newLine);

    const currentCursor = editor.getCursor();
    editor.setCursor({
      line: currentCursor.line,
      ch: currentCursor.ch - typed.length + link.length,
    });

    if (plugin.undoStack.length > 10) plugin.undoStack.shift();
  }
}

export function acceptSuggestion(
  plugin: AutoLinkPluginContext,
  editor: Editor,
  match: NoteMatch,
  typed: string,
) {
  const cursor = editor.getCursor();
  const line = editor.getLine(cursor.line);

  plugin.undoStack.push({
    line: cursor.line,
    original: line,
    cursor: { line: cursor.line, ch: cursor.ch },
    timestamp: Date.now(),
    linkText: match.file.basename,
  });

  const link = `[[${match.file.basename}${match.isAlias ? "|" + match.title : ""}]]`;

  const beforeCursor = line.slice(0, cursor.ch);
  const typedStartIndex = beforeCursor.lastIndexOf(typed);

  if (typedStartIndex === -1) {
    const newLine = line.replace(new RegExp(`${escapeRegex(typed)}$`), link);
    editor.setLine(cursor.line, newLine);
    editor.setCursor({
      line: cursor.line,
      ch: Math.min(newLine.length, cursor.ch - typed.length + link.length),
    });
  } else {
    const newLine =
      line.slice(0, typedStartIndex) +
      link +
      line.slice(typedStartIndex + typed.length);
    editor.setLine(cursor.line, newLine);
    const newCursorPos = typedStartIndex + link.length;
    editor.setCursor({
      line: cursor.line,
      ch: Math.min(newLine.length, newCursorPos),
    });
  }

  if (plugin.undoStack.length > 10) plugin.undoStack.shift();
}

export function temporarilyDisableAutoLink(plugin: AutoLinkPluginContext) {
  plugin.isAutoLinkDisabled = true;

  const win = window.activeWindow;
  if (plugin.disableTimeout && win) {
    win.clearTimeout(plugin.disableTimeout);
  }

  plugin.disableTimeout =
    win?.setTimeout(() => {
      plugin.isAutoLinkDisabled = false;
      plugin.disableTimeout = null;
    }, 1000) ?? null;
}

export function undoLastAutolink(
  plugin: AutoLinkPluginContext,
  editor: Editor,
): boolean {
  if (plugin.undoStack.length === 0) return false;

  const lastAction = plugin.undoStack.pop();
  if (!lastAction) return false;
  editor.setLine(lastAction.line, lastAction.original);
  editor.setCursor(lastAction.cursor);

  return true;
}

export function handleEditorChange(
  plugin: AutoLinkPluginContext,
  editor: Editor,
  view: MarkdownView,
) {
  if (!editor || !view) return;
  if (plugin.isAutoLinkDisabled) return;

  const cursor = editor.getCursor();
  let line = editor.getLine(cursor.line);

  const bulletMatch = line.match(/^(\s*)([-*+]|\d+\.)\s+/);
  let bulletPrefix = "";
  let processedLine = line;
  let processedCursorCh = cursor.ch;

  if (bulletMatch) {
    bulletPrefix = bulletMatch[0];
    processedLine = line.slice(bulletPrefix.length);
    processedCursorCh = Math.max(0, cursor.ch - bulletPrefix.length);
  }

  if (isInsideLink(processedLine, processedCursorCh)) return;

  const beforeCursor = processedLine.slice(0, processedCursorCh);
  const match = beforeCursor.match(/[\w\s\-_]+$/);
  if (!match) {
    plugin.pendingMatches.clear();
    return;
  }

  const currentFile = view.file;
  const currentBasename = currentFile?.basename || "";

  const bestMatch = getBestMatch(plugin, match[0], currentBasename);
  const typed = bestMatch.term;
  const matches = bestMatch.matches;

  if (typed.length < plugin.settings.minWordLength) {
    plugin.pendingMatches.clear();
    return;
  }

  plugin.pendingMatches.set(typed, matches);

  const justTypedChar = cursor.ch > 0 ? line[cursor.ch - 1] : "";

  const isWordCompleting = /[\s.,!?;:()[\]{}|\\/<>@#$%^&*+=~`"'-]/.test(
    justTypedChar,
  );

  if (
    (plugin.settings.mode === "autonomous" ||
      plugin.settings.mode === "semiAutonomous") &&
    isWordCompleting
  ) {
    const beforeDelimiter = processedLine.slice(0, processedCursorCh - 1);
    const wordMatch = beforeDelimiter.match(/[\w\s\-_]+$/);

    if (wordMatch) {
      const completedBestMatch = getBestMatch(
        plugin,
        wordMatch[0],
        currentBasename,
      );
      const completedWord = completedBestMatch.term;
      const completedMatches = completedBestMatch.matches;

      if (completedMatches.length === 1) {
        const wasWaiting =
          plugin.pendingMatches.has(completedWord) &&
          plugin.pendingMatches.get(completedWord)!.length > 1;

        if (wasWaiting || completedMatches.length === 1) {
          insertLinkForCompletedWord(
            plugin,
            editor,
            completedWord,
            completedMatches[0],
            processedCursorCh - 1,
            bulletPrefix,
          );
          plugin.pendingMatches.clear();
          return;
        }
      }
    }
  }

  switch (plugin.settings.mode) {
    case "autonomous":
    case "semiAutonomous":
      break;

    case "suggestions":
    case "custom":
      if (
        plugin.settings.mode === "custom" &&
        matches.length === 1 &&
        plugin.settings.customAutoInsertSingleMatch
      ) {
        handleAutonomousMode(
          plugin,
          editor,
          typed,
          matches,
          { line: cursor.line, ch: processedCursorCh },
          bulletPrefix,
        );
      }
      break;
  }
}
