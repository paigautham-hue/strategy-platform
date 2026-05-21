/**
 * Unit tests — Causal-Lite Attribution (server/agents/attribution.ts)
 * IMPLEMENTATION_PLAN.md Phase 6 / Workstream 6.4
 */

import { describe, it, expect } from "vitest";
import { normalizeAttribution } from "../agents/attribution";

describe("attribution — normalizeAttribution", () => {
  it("normalizes a well-formed attribution", () => {
    const r = normalizeAttribution(
      {
        whatWorked: ["The free trial drove signups"],
        whatDidnt: ["Onboarding emails underperformed"],
        variablesChanged: ["Added a free trial", "Rewrote the landing page"],
        counterfactual: "Signups would likely have grown 5% on market tailwind alone.",
        creditAssignment: [
          { factor: "Free trial", contribution: "high", isInternal: true },
          { factor: "Market tailwind", contribution: "medium", isInternal: false },
        ],
        confounders: ["A competitor raised prices the same quarter"],
        lesson: "Free trials work when switching cost is low.",
      },
      "Launch a free trial",
    );
    expect(r.initiative).toBe("Launch a free trial");
    expect(r.whatWorked).toHaveLength(1);
    expect(r.whatDidnt).toHaveLength(1);
    expect(r.creditAssignment).toHaveLength(2);
    expect(r.creditAssignment[0].isInternal).toBe(true);
    expect(r.confounders).toHaveLength(1);
    expect(r.hasFailureTrace).toBe(true);
  });

  it("flags the absence of failure traces", () => {
    const r = normalizeAttribution(
      { counterfactual: "c", lesson: "l", whatWorked: ["Everything went great"] },
      "I",
    );
    expect(r.whatDidnt).toEqual([]);
    expect(r.hasFailureTrace).toBe(false);
  });

  it("defaults an unknown contribution to medium and isInternal to false", () => {
    const r = normalizeAttribution(
      {
        counterfactual: "c",
        lesson: "l",
        creditAssignment: [{ factor: "x", contribution: "enormous" }],
      },
      "I",
    );
    expect(r.creditAssignment[0].contribution).toBe("medium");
    expect(r.creditAssignment[0].isInternal).toBe(false);
  });

  it("drops credit factors with no factor text", () => {
    const r = normalizeAttribution(
      {
        counterfactual: "c",
        lesson: "l",
        creditAssignment: [
          { contribution: "high", isInternal: true },
          { factor: "Real factor", contribution: "low", isInternal: false },
        ],
      },
      "I",
    );
    expect(r.creditAssignment).toHaveLength(1);
    expect(r.creditAssignment[0].factor).toBe("Real factor");
  });

  it("supplies fallbacks for a non-object payload", () => {
    const r = normalizeAttribution(null, "I");
    expect(r.counterfactual).toBe("No counterfactual was produced.");
    expect(r.lesson).toBe("No lesson was extracted.");
    expect(r.whatWorked).toEqual([]);
    expect(r.hasFailureTrace).toBe(false);
  });
});
