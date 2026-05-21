/**
 * Unit tests — Brainstorm Mode (server/agents/brainstorm.ts)
 * IMPLEMENTATION_PLAN.md Phase 4 / Workstream 4.2
 */

import { describe, it, expect } from "vitest";
import {
  BRAINSTORM_PHASES,
  nextPhase,
  getPhase,
  normalizeCaptures,
  captureCount,
  normalizeRecap,
} from "../agents/brainstorm";

describe("brainstorm — phase state machine", () => {
  it("has the four phases in order", () => {
    expect(BRAINSTORM_PHASES.map((p) => p.id)).toEqual([
      "diverge",
      "probe",
      "sharpen",
      "lock",
    ]);
  });

  it("advances through the phases and stops at lock", () => {
    expect(nextPhase("diverge")).toBe("probe");
    expect(nextPhase("probe")).toBe("sharpen");
    expect(nextPhase("sharpen")).toBe("lock");
    expect(nextPhase("lock")).toBeNull();
  });

  it("looks up a phase by id", () => {
    expect(getPhase("sharpen").label).toBe("Sharpen");
  });
});

describe("brainstorm — normalizeCaptures", () => {
  it("normalizes a well-formed payload across all five categories", () => {
    const c = normalizeCaptures({
      hypotheses: ["Customers want X"],
      options: ["Build X", "Partner for X"],
      assumptions: ["Budget is fixed"],
      risks: ["Competitor copies it"],
      openQuestions: ["What is the pricing?"],
    });
    expect(c.hypotheses).toHaveLength(1);
    expect(c.options).toHaveLength(2);
    expect(captureCount(c)).toBe(6);
  });

  it("drops empty and duplicate items (case-insensitive)", () => {
    const c = normalizeCaptures({
      hypotheses: ["A", "", "  ", "a", "B"],
      options: [],
      assumptions: [],
      risks: [],
      openQuestions: [],
    });
    expect(c.hypotheses).toEqual(["A", "B"]);
  });

  it("caps each category at 15 items", () => {
    const c = normalizeCaptures({
      hypotheses: [...Array(20).keys()].map((i) => `Hypothesis ${i}`),
      options: [],
      assumptions: [],
      risks: [],
      openQuestions: [],
    });
    expect(c.hypotheses).toHaveLength(15);
  });

  it("handles a non-object payload as empty captures", () => {
    const c = normalizeCaptures(null);
    expect(captureCount(c)).toBe(0);
  });
});

describe("brainstorm — normalizeRecap", () => {
  it("normalizes a well-formed recap", () => {
    const r = normalizeRecap({
      recap: "You returned to pricing three times.",
      suggestedMoves: ["Deep research on pricing", "War-game option 2"],
    });
    expect(r.recap).toContain("pricing");
    expect(r.suggestedMoves).toHaveLength(2);
  });

  it("supplies a fallback recap and caps moves at 6", () => {
    const r = normalizeRecap({
      suggestedMoves: [...Array(10).keys()].map((i) => `Move ${i}`),
    });
    expect(r.recap).toBe("The brainstorm produced no clear recap.");
    expect(r.suggestedMoves).toHaveLength(6);
  });

  it("handles a non-object payload", () => {
    const r = normalizeRecap(null);
    expect(r.recap).toBe("The brainstorm produced no clear recap.");
    expect(r.suggestedMoves).toEqual([]);
  });
});
