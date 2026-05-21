/**
 * Text Chunking — IMPLEMENTATION_PLAN.md Workstream 1.2
 *
 * Splits an ingested document into overlapping, boundary-respecting chunks
 * sized for the claim-extraction LLM call. Splitting prefers natural
 * boundaries (paragraph → sentence → hard slice) so a claim is never cut in
 * half, and consecutive chunks overlap so a claim straddling a boundary is
 * still wholly visible in at least one chunk.
 *
 * Contract:
 *   - chunk "cores" exactly partition the normalised text: for adjacent
 *     chunks, `chunk[i].charEnd === chunk[i+1].charStart`, the first starts
 *     at 0 and the last ends at text length.
 *   - `text` is what the extractor sees: the core, plus an overlap prefix
 *     carried from the previous chunk (empty for chunk 0).
 *
 * Pure function. No DB, no LLM.
 */

export interface Chunk {
  /** 0-based position in the document. */
  index: number;
  /** Text handed to the extractor — core content plus any overlap prefix. */
  text: string;
  /** Start offset of this chunk's CORE in the normalised text. */
  charStart: number;
  /** End offset (exclusive) of this chunk's CORE in the normalised text. */
  charEnd: number;
  /** Length of the overlap prefix carried from the previous chunk. */
  overlapChars: number;
}

export interface ChunkOptions {
  /** Target core size in characters. Default 2000. */
  targetChars?: number;
  /** Characters of the previous chunk to repeat as a prefix. Default 200. */
  overlapChars?: number;
}

const DEFAULT_TARGET = 2000;
const DEFAULT_OVERLAP = 200;

/** A unit of text with its span in the normalised source. */
interface Segment {
  text: string;
  start: number;
  end: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// SEGMENTATION
// ─────────────────────────────────────────────────────────────────────────────

/** Normalise line endings; trailing whitespace is left intact for offsets. */
function normalize(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

/**
 * Break the text into segments no larger than `maxChars`, preferring
 * paragraph boundaries, then sentence boundaries, then a hard slice.
 * Segment spans are exact offsets into `text`.
 */
function segment(text: string, maxChars: number): Segment[] {
  const segments: Segment[] = [];

  // Paragraph split — keep offsets by walking the original string.
  const paraRegex = /\n[ \t]*\n/g;
  let paraStart = 0;
  const paraSpans: Array<[number, number]> = [];
  let m: RegExpExecArray | null;
  while ((m = paraRegex.exec(text)) !== null) {
    paraSpans.push([paraStart, m.index]);
    paraStart = m.index + m[0].length;
  }
  paraSpans.push([paraStart, text.length]);

  for (const [pStart, pEnd] of paraSpans) {
    if (pEnd <= pStart) continue;
    const paraText = text.slice(pStart, pEnd);
    if (paraText.trim().length === 0) continue;

    if (paraText.length <= maxChars) {
      segments.push({ text: paraText, start: pStart, end: pEnd });
      continue;
    }

    // Oversized paragraph → split into sentences.
    for (const sent of splitSentences(paraText, pStart)) {
      if (sent.text.length <= maxChars) {
        segments.push(sent);
      } else {
        // Oversized sentence → hard slice.
        for (let i = sent.start; i < sent.end; i += maxChars) {
          const sliceEnd = Math.min(i + maxChars, sent.end);
          segments.push({ text: text.slice(i, sliceEnd), start: i, end: sliceEnd });
        }
      }
    }
  }

  return segments;
}

/** Split a paragraph into sentence segments, offsets relative to `baseOffset`. */
function splitSentences(paragraph: string, baseOffset: number): Segment[] {
  const out: Segment[] = [];
  // End of sentence: . ! or ? followed by whitespace or end of string.
  const sentenceEnd = /[.!?]+(?=\s|$)/g;
  let start = 0;
  let m: RegExpExecArray | null;
  while ((m = sentenceEnd.exec(paragraph)) !== null) {
    const end = m.index + m[0].length;
    const text = paragraph.slice(start, end);
    if (text.trim().length > 0) {
      out.push({ text, start: baseOffset + start, end: baseOffset + end });
    }
    start = end;
  }
  // Trailing remainder with no terminal punctuation.
  if (start < paragraph.length) {
    const text = paragraph.slice(start);
    if (text.trim().length > 0) {
      out.push({ text, start: baseOffset + start, end: baseOffset + paragraph.length });
    }
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// CHUNKING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Split `text` into overlapping, boundary-respecting chunks.
 *
 * @returns chunks in document order. Empty array for empty/whitespace input.
 */
export function chunkText(text: string, options: ChunkOptions = {}): Chunk[] {
  const targetChars = options.targetChars ?? DEFAULT_TARGET;
  const overlapChars = options.overlapChars ?? DEFAULT_OVERLAP;
  if (targetChars <= 0) {
    throw new Error(`chunkText: targetChars must be positive, got ${targetChars}`);
  }
  if (overlapChars < 0 || overlapChars >= targetChars) {
    throw new Error(
      `chunkText: overlapChars must be in [0, targetChars), got ${overlapChars}`,
    );
  }

  const normalized = normalize(text);
  if (normalized.trim().length === 0) return [];

  const segments = segment(normalized, targetChars);
  if (segments.length === 0) return [];

  // Greedily pack segments into chunk cores up to targetChars.
  const cores: Array<{ start: number; end: number; text: string }> = [];
  let current: { start: number; end: number; text: string } | null = null;

  for (const seg of segments) {
    if (current === null) {
      current = { start: seg.start, end: seg.end, text: seg.text };
      continue;
    }
    if (current.text.length + seg.text.length <= targetChars) {
      // Extend the current core; include any gap text between segments so the
      // cores remain a contiguous partition of the normalised text.
      current.text = normalized.slice(current.start, seg.end);
      current.end = seg.end;
    } else {
      cores.push(current);
      current = { start: seg.start, end: seg.end, text: seg.text };
    }
  }
  if (current !== null) cores.push(current);

  // Make the cores a gap-free partition: each core ends where the next begins,
  // the first starts at 0, the last ends at normalized.length.
  for (let i = 0; i < cores.length; i++) {
    const start = i === 0 ? 0 : cores[i - 1].end;
    const end = i === cores.length - 1 ? normalized.length : cores[i].end;
    cores[i].start = start;
    cores[i].end = end;
    cores[i].text = normalized.slice(start, end);
  }

  // Emit chunks, prepending an overlap tail from the previous core.
  return cores.map((core, index) => {
    let overlapPrefix = "";
    if (index > 0 && overlapChars > 0) {
      const prev = cores[index - 1];
      const overlapStart = Math.max(prev.start, prev.end - overlapChars);
      overlapPrefix = normalized.slice(overlapStart, prev.end);
    }
    return {
      index,
      text: overlapPrefix + core.text,
      charStart: core.start,
      charEnd: core.end,
      overlapChars: overlapPrefix.length,
    };
  });
}
