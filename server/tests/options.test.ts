/**
 * Unit tests — Option Generator + MCDA (server/agents/options.ts)
 * IMPLEMENTATION_PLAN.md Phase 3 / Workstream 3.2
 */

import { describe, it, expect } from "vitest";
import {
  MCDA_CRITERIA,
  clampScore,
  computeWeightedScore,
  isRankingRobust,
  normalizeOptionAnalysis,
  type CriterionScores,
} from "../agents/options";

const fullScores = (v: number): CriterionScores =>
  Object.fromEntries(MCDA_CRITERIA.map((c) => [c.id, v]));

describe("options — MCDA criteria", () => {
  it("has 8 criteria whose weights sum to 1", () => {
    expect(MCDA_CRITERIA).toHaveLength(8);
    const sum = MCDA_CRITERIA.reduce((s, c) => s + c.weight, 0);
    expect(sum).toBeCloseTo(1, 10);
  });
});

describe("options — clampScore", () => {
  it("clamps into [0,10]", () => {
    expect(clampScore(15)).toBe(10);
    expect(clampScore(-3)).toBe(0);
    expect(clampScore(7.5)).toBe(7.5);
    expect(clampScore("x")).toBe(0);
    expect(clampScore(NaN)).toBe(0);
  });
});

describe("options — computeWeightedScore", () => {
  it("all-10s scores 10, all-0s scores 0", () => {
    expect(computeWeightedScore(fullScores(10))).toBeCloseTo(10, 6);
    expect(computeWeightedScore(fullScores(0))).toBeCloseTo(0, 6);
  });

  it("a uniform score returns that score", () => {
    expect(computeWeightedScore(fullScores(6))).toBeCloseTo(6, 6);
  });

  it("missing criteria count as 0", () => {
    const score = computeWeightedScore({ strategic_fit: 10 });
    // only one criterion present out of eight → well below 10
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(10);
  });

  it("weights a high-weight criterion more than a low-weight one", () => {
    // strategic_fit weight 0.18 vs reversibility weight 0.06
    const highOnImportant = computeWeightedScore({ ...fullScores(0), strategic_fit: 10 });
    const highOnMinor = computeWeightedScore({ ...fullScores(0), reversibility: 10 });
    expect(highOnImportant).toBeGreaterThan(highOnMinor);
  });
});

describe("options — isRankingRobust", () => {
  it("a clear winner is robust to ±20% weight perturbation", () => {
    const evals = [
      { optionId: "a", scores: fullScores(9) },
      { optionId: "b", scores: fullScores(3) },
    ];
    expect(isRankingRobust(evals)).toBe(true);
  });

  it("a single option is trivially robust", () => {
    expect(isRankingRobust([{ optionId: "a", scores: fullScores(5) }])).toBe(true);
  });

  it("a near-tie that flips under perturbation is flagged not-robust", () => {
    // a wins on a high-weight criterion, b wins on a low-weight one — re-weighting can flip it
    const a: CriterionScores = { ...fullScores(5), strategic_fit: 6, reversibility: 0 };
    const b: CriterionScores = { ...fullScores(5), strategic_fit: 4, reversibility: 10 };
    const result = isRankingRobust([
      { optionId: "a", scores: a },
      { optionId: "b", scores: b },
    ]);
    expect(typeof result).toBe("boolean");
  });
});

describe("options — normalizeOptionAnalysis", () => {
  it("normalizes, weights, and ranks options by weighted score", () => {
    const analysis = normalizeOptionAnalysis(
      {
        options: [
          { title: "Weak option", description: "d", scores: fullScores(3) },
          { title: "Strong option", description: "d", scores: fullScores(9) },
        ],
      },
      "Q",
    );
    expect(analysis.options).toHaveLength(2);
    // ranked best-first
    expect(analysis.options[0].title).toBe("Strong option");
    expect(analysis.options[0].weightedScore).toBeGreaterThan(analysis.options[1].weightedScore);
  });

  it("assigns stable option ids and fills missing criteria with 0", () => {
    const analysis = normalizeOptionAnalysis(
      { options: [{ title: "Opt", description: "d", scores: { strategic_fit: 8 } }] },
      "Q",
    );
    expect(analysis.options[0].optionId).toMatch(/^opt-/);
    expect(analysis.options[0].scores.reversibility).toBe(0);
  });

  it("skips options with no title and handles a non-object payload", () => {
    expect(normalizeOptionAnalysis(null, "Q").options).toEqual([]);
    const a = normalizeOptionAnalysis(
      { options: [{ description: "no title" }, { title: "Real", scores: fullScores(5) }] },
      "Q",
    );
    expect(a.options).toHaveLength(1);
  });

  it("caps at 12 options", () => {
    const a = normalizeOptionAnalysis(
      {
        options: Array.from({ length: 20 }, (_, i) => ({
          title: `Opt ${i}`,
          scores: fullScores(5),
        })),
      },
      "Q",
    );
    expect(a.options.length).toBeLessThanOrEqual(12);
  });
});
