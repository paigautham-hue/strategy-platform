/**
 * Prompt Compression — IMPLEMENTATION_PLAN.md Phase 8, Workstream 8.2
 *
 * Structural prompt compression: strip the slack out of a prompt before it is
 * sent, without changing its meaning. Every token saved is token cost not
 * paid. The transforms here are deliberately CONSERVATIVE and lossless to the
 * reader — they never paraphrase or drop content:
 *
 *   - trailing whitespace removed from every line
 *   - runs of blank lines collapsed to a single blank line
 *   - consecutive duplicate lines de-duplicated
 *   - runs of 3+ spaces inside a line collapsed (leading indentation kept)
 *
 * An optional hard character cap truncates over-long context with a marker.
 */

export interface CompressionResult {
  text: string;
  originalLength: number;
  compressedLength: number;
  /** Fraction of characters removed, 0–1. */
  savedRatio: number;
}

export interface CompressionOptions {
  /** Hard cap on the output length; over-long input is truncated. */
  maxChars?: number;
}

const TRUNCATION_MARKER = "\n…[truncated]";

/**
 * Compress a prompt structurally. Pure — exported for tests.
 */
export function compressPrompt(text: string, opts: CompressionOptions = {}): CompressionResult {
  const originalLength = text.length;

  const lines = text.split("\n");
  const cleaned: string[] = [];
  let blankRun = 0;
  let lastNonBlank: string | null = null;

  for (const raw of lines) {
    // Trim trailing whitespace; collapse 3+ interior spaces but keep indentation.
    const trimmedEnd = raw.replace(/\s+$/, "");
    const indentMatch = trimmedEnd.match(/^\s*/);
    const indent = indentMatch ? indentMatch[0] : "";
    const body = trimmedEnd.slice(indent.length).replace(/ {3,}/g, " ");
    const line = indent + body;

    if (line.trim() === "") {
      blankRun += 1;
      if (blankRun <= 1) cleaned.push("");
      continue;
    }
    blankRun = 0;

    // Drop a line identical to the immediately preceding non-blank line.
    if (line === lastNonBlank) continue;
    lastNonBlank = line;
    cleaned.push(line);
  }

  // Drop leading / trailing blank lines.
  while (cleaned.length && cleaned[0] === "") cleaned.shift();
  while (cleaned.length && cleaned[cleaned.length - 1] === "") cleaned.pop();

  let out = cleaned.join("\n");

  if (opts.maxChars && out.length > opts.maxChars) {
    const budget = Math.max(0, opts.maxChars - TRUNCATION_MARKER.length);
    out = out.slice(0, budget) + TRUNCATION_MARKER;
  }

  return {
    text: out,
    originalLength,
    compressedLength: out.length,
    savedRatio:
      originalLength === 0
        ? 0
        : Math.round(((originalLength - out.length) / originalLength) * 10000) / 10000,
  };
}
