/**
 * Unit tests — Strategy Decomposer (server/agents/decomposer.ts)
 * IMPLEMENTATION_PLAN.md Phase 5 / Workstream 5.1
 */

import { describe, it, expect } from "vitest";
import {
  isQuantitative,
  flagVagueObjectives,
  normalizeDecomposition,
  type Initiative,
} from "../agents/decomposer";

describe("decomposer — isQuantitative", () => {
  it("recognizes numbers, percentages, and currency", () => {
    expect(isQuantitative("Grow ARR to $5M")).toBe(true);
    expect(isQuantitative("Lift NRR by 12%")).toBe(true);
    expect(isQuantitative("Reach 3 new markets")).toBe(true);
  });

  it("rejects a vague, unmeasurable key result", () => {
    expect(isQuantitative("Improve customer happiness meaningfully")).toBe(false);
    expect(isQuantitative("Become the market leader")).toBe(false);
  });
});

describe("decomposer — flagVagueObjectives", () => {
  const initiative = (okrs: Initiative["okrs"]): Initiative => ({
    title: "T",
    rationale: "R",
    expectedImpact: "",
    costEstimate: "",
    confidence: 0.5,
    dependencies: [],
    okrs,
    tasks: [],
  });

  it("flags an objective whose key results are all unmeasurable", () => {
    const flagged = flagVagueObjectives([
      initiative([
        {
          objective: "Be more customer-centric",
          keyResults: [
            { text: "Listen to customers more", indicator: "leading", quantitative: false },
          ],
        },
      ]),
    ]);
    expect(flagged).toEqual(["Be more customer-centric"]);
  });

  it("does not flag an objective with at least one quantitative key result", () => {
    const flagged = flagVagueObjectives([
      initiative([
        {
          objective: "Grow enterprise revenue",
          keyResults: [
            { text: "Soft: build relationships", indicator: "leading", quantitative: false },
            { text: "Close 10 enterprise deals", indicator: "lagging", quantitative: true },
          ],
        },
      ]),
    ]);
    expect(flagged).toEqual([]);
  });
});

describe("decomposer — normalizeDecomposition", () => {
  it("normalizes a well-formed decomposition and derives quantitative + counts", () => {
    const d = normalizeDecomposition(
      {
        initiatives: [
          {
            title: "Launch usage-based pricing",
            rationale: "Captures value from large accounts.",
            expectedImpact: "+15% NRR",
            costEstimate: "2 eng-months",
            confidence: 0.7,
            dependencies: ["Billing rework"],
            okrs: [
              {
                objective: "Roll out usage-based pricing",
                keyResults: [
                  { text: "Migrate 20 accounts", indicator: "lagging" },
                  { text: "Ship the metering pipeline", indicator: "leading" },
                ],
              },
            ],
            tasks: ["Draft pricing tiers", "Build the meter"],
          },
        ],
      },
      "Move upmarket",
    );
    expect(d.thesis).toBe("Move upmarket");
    expect(d.initiatives).toHaveLength(1);
    expect(d.okrCount).toBe(1);
    expect(d.initiatives[0].okrs[0].keyResults[0].quantitative).toBe(true);
    expect(d.initiatives[0].okrs[0].keyResults[1].quantitative).toBe(false);
    expect(d.vagueObjectives).toEqual([]);
  });

  it("clamps confidence and defaults a missing indicator to lagging", () => {
    const d = normalizeDecomposition(
      {
        initiatives: [
          {
            title: "X",
            rationale: "R",
            confidence: 5,
            okrs: [{ objective: "O", keyResults: [{ text: "Do the thing" }] }],
          },
        ],
      },
      "T",
    );
    expect(d.initiatives[0].confidence).toBe(1);
    expect(d.initiatives[0].okrs[0].keyResults[0].indicator).toBe("lagging");
  });

  it("flags vague objectives via the challenger", () => {
    const d = normalizeDecomposition(
      {
        initiatives: [
          {
            title: "X",
            rationale: "R",
            okrs: [{ objective: "Be excellent", keyResults: [{ text: "Try hard" }] }],
          },
        ],
      },
      "T",
    );
    expect(d.vagueObjectives).toEqual(["Be excellent"]);
  });

  it("handles a non-object payload", () => {
    const d = normalizeDecomposition(null, "T");
    expect(d.initiatives).toEqual([]);
    expect(d.okrCount).toBe(0);
    expect(d.vagueObjectives).toEqual([]);
  });
});
