/**
 * Unit tests — Diagnosis Agent normalisation (server/agents/diagnosis.ts)
 * IMPLEMENTATION_PLAN.md Phase 2 / Workstream 2.2
 */

import { describe, it, expect } from "vitest";
import { normalizeDiagnosis, QUESTION_TYPES } from "../agents/diagnosis";

const ORIGINAL = "Should we build an AI feature to keep up with competitors?";

describe("diagnosis — normalizeDiagnosis", () => {
  it("normalizes a well-formed diagnosis", () => {
    const d = normalizeDiagnosis(
      {
        reframedQuestion: "What customer job would an AI feature do better than our current product?",
        questionType: "competitive_response",
        keyUnknowns: ["Which competitor capability is actually winning deals?"],
        suggestedFrameworks: ["JTBD", "Porter Five Forces"],
        rationale: "The asked question presumes AI is the answer.",
        confidence: "high",
      },
      ORIGINAL,
    );
    expect(d.questionType).toBe("competitive_response");
    expect(d.confidence).toBe("high");
    expect(d.keyUnknowns).toHaveLength(1);
    expect(d.suggestedFrameworks).toEqual(["JTBD", "Porter Five Forces"]);
  });

  it("defaults an unknown question type to custom", () => {
    const d = normalizeDiagnosis(
      { reframedQuestion: "Q", questionType: "moonshot", confidence: "high" },
      ORIGINAL,
    );
    expect(d.questionType).toBe("custom");
  });

  it("defaults an invalid confidence to low", () => {
    const d = normalizeDiagnosis(
      { reframedQuestion: "Q", questionType: "pricing", confidence: "certain" },
      ORIGINAL,
    );
    expect(d.confidence).toBe("low");
  });

  it("falls back to the original question when reframing is missing", () => {
    const d = normalizeDiagnosis({ questionType: "adjacency", confidence: "medium" }, ORIGINAL);
    expect(d.reframedQuestion).toBe(ORIGINAL);
  });

  it("handles a non-object payload", () => {
    const d = normalizeDiagnosis(null, ORIGINAL);
    expect(d.questionType).toBe("custom");
    expect(d.confidence).toBe("low");
    expect(d.reframedQuestion).toBe(ORIGINAL);
  });

  it("filters non-string and empty list items", () => {
    const d = normalizeDiagnosis(
      {
        reframedQuestion: "Q",
        questionType: "white_space",
        confidence: "high",
        keyUnknowns: ["Real unknown", "", 7, null, "Another"],
      },
      ORIGINAL,
    );
    expect(d.keyUnknowns).toEqual(["Real unknown", "Another"]);
  });

  it("caps list fields at 12 items", () => {
    const d = normalizeDiagnosis(
      {
        reframedQuestion: "Q",
        questionType: "portfolio",
        confidence: "high",
        suggestedFrameworks: Array.from({ length: 30 }, (_, i) => `F${i}`),
      },
      ORIGINAL,
    );
    expect(d.suggestedFrameworks).toHaveLength(12);
  });

  it("every question type in the taxonomy round-trips", () => {
    for (const t of QUESTION_TYPES) {
      const d = normalizeDiagnosis(
        { reframedQuestion: "Q", questionType: t, confidence: "high" },
        ORIGINAL,
      );
      expect(d.questionType).toBe(t);
    }
  });
});
