/**
 * Unit tests — Pattern Mining (server/agents/pattern-mining.ts)
 * IMPLEMENTATION_PLAN.md Phase 6 / Workstream 6.2
 */

import { describe, it, expect } from "vitest";
import { normalizeMining } from "../agents/pattern-mining";

describe("pattern-mining — normalizeMining", () => {
  it("normalizes a well-formed mining result", () => {
    const r = normalizeMining(
      {
        patterns: [
          {
            name: "Beachhead then expand",
            description: "Win a narrow segment, then widen.",
            whenItApplies: "Fragmented market, low switching cost.",
            typicalOutcome: "Durable share in the niche.",
            support: 3,
          },
        ],
        antiPatterns: [
          {
            name: "Premature scaling",
            description: "Scaling spend before product-market fit.",
            failureMode: "Cash burns out before retention proves.",
            support: 2,
          },
        ],
      },
      4,
    );
    expect(r.projectsAnalyzed).toBe(4);
    expect(r.patterns).toHaveLength(1);
    expect(r.patterns[0].support).toBe(3);
    expect(r.antiPatterns).toHaveLength(1);
    expect(r.antiPatterns[0].failureMode).toContain("Cash");
  });

  it("drops patterns missing a name or description", () => {
    const r = normalizeMining(
      {
        patterns: [
          { name: "No description" },
          { description: "No name" },
          { name: "Complete", description: "Has both" },
        ],
        antiPatterns: [],
      },
      3,
    );
    expect(r.patterns).toHaveLength(1);
    expect(r.patterns[0].name).toBe("Complete");
  });

  it("clamps support to at least 1 and at most the project count", () => {
    const r = normalizeMining(
      {
        patterns: [
          { name: "A", description: "d", support: 0 },
          { name: "B", description: "d", support: 99 },
        ],
        antiPatterns: [],
      },
      5,
    );
    expect(r.patterns[0].support).toBe(1);
    expect(r.patterns[1].support).toBe(5);
  });

  it("handles a non-object payload", () => {
    const r = normalizeMining(null, 2);
    expect(r.patterns).toEqual([]);
    expect(r.antiPatterns).toEqual([]);
    expect(r.projectsAnalyzed).toBe(2);
  });
});
