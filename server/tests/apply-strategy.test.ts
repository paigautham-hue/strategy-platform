/**
 * Unit tests — Share-and-Apply normalisation (server/agents/apply-strategy.ts)
 * IMPLEMENTATION_PLAN.md Phase 2 / Workstream 2.8
 */

import { describe, it, expect } from "vitest";
import { normalizeApplication } from "../agents/apply-strategy";

describe("apply-strategy — normalizeApplication", () => {
  it("normalizes a well-formed application", () => {
    const a = normalizeApplication({
      fitScore: 72,
      fitRationale: "Strong channel overlap, weak on the data prerequisite.",
      gaps: ["No usage instrumentation in place"],
      adaptedMoves: [
        { original: "Seed with a single team", adapted: "Seed with the Hamburg pilot account" },
      ],
      risks: ["Long enterprise sales cycle slows the expansion trigger"],
      recommendation: "adapt-heavily — fix instrumentation first",
      applicationMemo: "Northwind should pursue land-and-expand after closing the data gap.",
    });
    expect(a.fitScore).toBe(72);
    expect(a.gaps).toHaveLength(1);
    expect(a.adaptedMoves).toHaveLength(1);
    expect(a.adaptedMoves[0].adapted).toContain("Hamburg");
  });

  it("clamps and rounds the fit score into [0,100]", () => {
    expect(normalizeApplication({ fitScore: 140 }).fitScore).toBe(100);
    expect(normalizeApplication({ fitScore: -20 }).fitScore).toBe(0);
    expect(normalizeApplication({ fitScore: 61.7 }).fitScore).toBe(62);
    expect(normalizeApplication({ fitScore: "high" }).fitScore).toBe(0);
  });

  it("handles a non-object payload", () => {
    const a = normalizeApplication(null);
    expect(a.fitScore).toBe(0);
    expect(a.gaps).toEqual([]);
    expect(a.adaptedMoves).toEqual([]);
    expect(a.recommendation).toBeTruthy();
  });

  it("an adapted move with only an original still resolves", () => {
    const a = normalizeApplication({
      fitScore: 50,
      adaptedMoves: [{ original: "Do the thing" }],
    });
    expect(a.adaptedMoves[0].original).toBe("Do the thing");
    expect(a.adaptedMoves[0].adapted).toBe("Do the thing");
  });

  it("drops malformed adapted-move entries", () => {
    const a = normalizeApplication({
      fitScore: 50,
      adaptedMoves: [null, "string", { original: "Real", adapted: "Adapted" }],
    });
    expect(a.adaptedMoves).toHaveLength(1);
  });

  it("caps list fields at 12 items", () => {
    const a = normalizeApplication({
      fitScore: 50,
      gaps: Array.from({ length: 30 }, (_, i) => `gap ${i}`),
    });
    expect(a.gaps).toHaveLength(12);
  });

  it("provides a default recommendation when missing", () => {
    expect(normalizeApplication({ fitScore: 40 }).recommendation).toBeTruthy();
  });
});
