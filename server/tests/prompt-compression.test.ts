/**
 * Unit tests — Prompt Compression (server/services/prompt-compression.ts)
 * IMPLEMENTATION_PLAN.md Phase 8 / Workstream 8.2
 */

import { describe, it, expect } from "vitest";
import { compressPrompt } from "../services/prompt-compression";

describe("prompt-compression — compressPrompt", () => {
  it("strips trailing whitespace from each line", () => {
    const r = compressPrompt("hello   \nworld\t\t");
    expect(r.text).toBe("hello\nworld");
  });

  it("collapses runs of blank lines to a single blank line", () => {
    const r = compressPrompt("a\n\n\n\n\nb");
    expect(r.text).toBe("a\n\nb");
  });

  it("de-duplicates consecutive identical lines", () => {
    const r = compressPrompt("same\nsame\nsame\ndifferent");
    expect(r.text).toBe("same\ndifferent");
  });

  it("collapses 3+ interior spaces but keeps leading indentation", () => {
    const r = compressPrompt("    indented     body");
    expect(r.text).toBe("    indented body");
  });

  it("trims leading and trailing blank lines", () => {
    const r = compressPrompt("\n\ncontent  \n\n");
    expect(r.text).toBe("content");
  });

  it("reports the saved ratio", () => {
    const r = compressPrompt("x   \nx   \nx   ");
    expect(r.originalLength).toBeGreaterThan(r.compressedLength);
    expect(r.savedRatio).toBeGreaterThan(0);
  });

  it("truncates to a hard character cap with a marker", () => {
    const r = compressPrompt("a".repeat(500), { maxChars: 50 });
    expect(r.text.length).toBe(50);
    expect(r.text.endsWith("…[truncated]")).toBe(true);
  });

  it("leaves an already-tight prompt unchanged", () => {
    const tight = "Line one\nLine two";
    const r = compressPrompt(tight);
    expect(r.text).toBe(tight);
    expect(r.savedRatio).toBe(0);
  });

  it("handles an empty string", () => {
    const r = compressPrompt("");
    expect(r.text).toBe("");
    expect(r.savedRatio).toBe(0);
  });
});
