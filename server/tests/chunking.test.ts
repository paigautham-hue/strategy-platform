/**
 * Unit tests — Text Chunking (server/ingest/chunking.ts)
 * IMPLEMENTATION_PLAN.md Workstream 1.2
 */

import { describe, it, expect } from "vitest";
import { chunkText, type Chunk } from "../ingest/chunking";

/** The documented invariant: text === normalized.slice(charStart - overlap, charEnd). */
function reconstructs(chunk: Chunk, normalized: string): boolean {
  return chunk.text === normalized.slice(chunk.charStart - chunk.overlapChars, chunk.charEnd);
}

/** Cores must form a gap-free partition [0, len). */
function partitions(chunks: Chunk[], len: number): boolean {
  if (chunks.length === 0) return len === 0;
  if (chunks[0].charStart !== 0) return false;
  for (let i = 0; i < chunks.length - 1; i++) {
    if (chunks[i].charEnd !== chunks[i + 1].charStart) return false;
  }
  return chunks[chunks.length - 1].charEnd === len;
}

describe("chunking — empty & trivial input", () => {
  it("empty or whitespace-only input → no chunks", () => {
    expect(chunkText("")).toEqual([]);
    expect(chunkText("   \n\n  \t ")).toEqual([]);
  });

  it("short text → a single chunk with no overlap", () => {
    const text = "Acme grew revenue 30% in 2026.";
    const chunks = chunkText(text);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].text).toBe(text);
    expect(chunks[0].charStart).toBe(0);
    expect(chunks[0].charEnd).toBe(text.length);
    expect(chunks[0].overlapChars).toBe(0);
    expect(chunks[0].index).toBe(0);
  });
});

describe("chunking — partition & reconstruction invariants", () => {
  it("cores partition the text gap-free, and every chunk reconstructs", () => {
    const para = "This is a sentence about strategy. ".repeat(20); // ~700 chars
    const text = [para, para, para].join("\n\n");
    const chunks = chunkText(text, { targetChars: 300, overlapChars: 40 });

    expect(chunks.length).toBeGreaterThan(1);
    expect(partitions(chunks, text.length)).toBe(true);
    for (const c of chunks) {
      expect(reconstructs(c, text)).toBe(true);
    }
  });

  it("indexes are sequential from 0", () => {
    const text = "Sentence one. ".repeat(100);
    const chunks = chunkText(text, { targetChars: 200, overlapChars: 20 });
    chunks.forEach((c, i) => expect(c.index).toBe(i));
  });
});

describe("chunking — overlap", () => {
  it("each chunk after the first carries an overlap prefix", () => {
    const text = "Distinct sentence number here. ".repeat(60);
    const chunks = chunkText(text, { targetChars: 250, overlapChars: 50 });
    expect(chunks.length).toBeGreaterThan(1);

    for (let i = 1; i < chunks.length; i++) {
      expect(chunks[i].overlapChars).toBeGreaterThan(0);
      expect(chunks[i].overlapChars).toBeLessThanOrEqual(50);
      // The overlap prefix is exactly the tail of the previous core.
      const prev = chunks[i - 1];
      const expectedOverlap = text.slice(prev.charEnd - chunks[i].overlapChars, prev.charEnd);
      expect(chunks[i].text.startsWith(expectedOverlap)).toBe(true);
    }
  });

  it("overlapChars = 0 produces no overlap", () => {
    const text = "Sentence content here. ".repeat(80);
    const chunks = chunkText(text, { targetChars: 300, overlapChars: 0 });
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.overlapChars).toBe(0);
  });
});

describe("chunking — boundary respecting", () => {
  it("an oversized single paragraph is split at sentence boundaries", () => {
    // One paragraph, no blank lines, longer than the target.
    const text = "Acme is strong in pricing. Beta leads on distribution. Gamma owns the data layer. Delta has the best brand. ".repeat(8);
    const chunks = chunkText(text, { targetChars: 200, overlapChars: 0 });
    expect(chunks.length).toBeGreaterThan(1);
    expect(partitions(chunks, text.length)).toBe(true);
  });

  it("an oversized run with no punctuation is hard-sliced", () => {
    const text = "x".repeat(1000); // no sentence boundaries at all
    const chunks = chunkText(text, { targetChars: 200, overlapChars: 0 });
    expect(chunks.length).toBe(5); // 1000 / 200
    expect(partitions(chunks, 1000)).toBe(true);
  });

  it("no core exceeds the target by more than a small margin", () => {
    const text = "A reasonably sized sentence about the market. ".repeat(100);
    const target = 400;
    const chunks = chunkText(text, { targetChars: target, overlapChars: 50 });
    for (const c of chunks) {
      expect(c.charEnd - c.charStart).toBeLessThanOrEqual(target + 50);
    }
  });
});

describe("chunking — normalization & options", () => {
  it("CRLF line endings are normalized away", () => {
    const text = "First paragraph.\r\n\r\nSecond paragraph.";
    const chunks = chunkText(text);
    expect(chunks[0].text).not.toContain("\r");
  });

  it("throws on invalid targetChars", () => {
    expect(() => chunkText("abc", { targetChars: 0 })).toThrow(/targetChars/);
    expect(() => chunkText("abc", { targetChars: -100 })).toThrow(/targetChars/);
  });

  it("throws when overlap is negative or >= target", () => {
    expect(() => chunkText("abc", { targetChars: 100, overlapChars: -1 })).toThrow(/overlapChars/);
    expect(() => chunkText("abc", { targetChars: 100, overlapChars: 100 })).toThrow(/overlapChars/);
  });
});
