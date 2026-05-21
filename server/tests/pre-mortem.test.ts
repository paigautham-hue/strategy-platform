/**
 * Unit tests — Pre-Mortem Launch Ritual (server/agents/pre-mortem.ts)
 * IMPLEMENTATION_PLAN.md Phase 5 / Workstream 5.1
 */

import { describe, it, expect } from "vitest";
import { riskSeverity, normalizePreMortem } from "../agents/pre-mortem";

describe("pre-mortem — riskSeverity", () => {
  it("maps likelihood x impact to a severity band", () => {
    expect(riskSeverity("high", "high")).toBe("critical");
    expect(riskSeverity("high", "medium")).toBe("high");
    expect(riskSeverity("medium", "medium")).toBe("medium");
    expect(riskSeverity("low", "high")).toBe("medium");
    expect(riskSeverity("low", "low")).toBe("low");
  });
});

describe("pre-mortem — normalizePreMortem", () => {
  it("normalizes a well-formed pre-mortem and derives severity", () => {
    const r = normalizePreMortem(
      {
        risks: [
          {
            risk: "The integration partner pulls out.",
            likelihood: "medium",
            impact: "high",
            earlyWarningSign: "Partner misses two check-ins.",
            mitigation: "Line up a backup partner now.",
          },
        ],
        topRisk: "Partner dependency.",
      },
      "Launch the integration",
    );
    expect(r.initiative).toBe("Launch the integration");
    expect(r.risks).toHaveLength(1);
    expect(r.risks[0].severity).toBe("high");
    expect(r.readyToLaunch).toBe(true);
  });

  it("sorts risks most-severe first", () => {
    const r = normalizePreMortem(
      {
        risks: [
          { risk: "Minor", likelihood: "low", impact: "low", mitigation: "m" },
          { risk: "Severe", likelihood: "high", impact: "high", mitigation: "m" },
          { risk: "Moderate", likelihood: "medium", impact: "medium", mitigation: "m" },
        ],
        topRisk: "Severe",
      },
      "I",
    );
    expect(r.risks.map((x) => x.risk)).toEqual(["Severe", "Moderate", "Minor"]);
  });

  it("is not ready to launch when a risk lacks a mitigation", () => {
    const r = normalizePreMortem(
      {
        risks: [
          { risk: "Has mitigation", likelihood: "low", impact: "low", mitigation: "m" },
          { risk: "No mitigation", likelihood: "high", impact: "high" },
        ],
        topRisk: "No mitigation",
      },
      "I",
    );
    expect(r.readyToLaunch).toBe(false);
  });

  it("defaults an unknown grade to medium", () => {
    const r = normalizePreMortem(
      { risks: [{ risk: "x", likelihood: "catastrophic", impact: "huge", mitigation: "m" }], topRisk: "x" },
      "I",
    );
    expect(r.risks[0].likelihood).toBe("medium");
    expect(r.risks[0].impact).toBe("medium");
  });

  it("falls back the top risk to the first risk and is not ready when empty", () => {
    const withRisks = normalizePreMortem(
      { risks: [{ risk: "First risk", likelihood: "low", impact: "low", mitigation: "m" }] },
      "I",
    );
    expect(withRisks.topRisk).toBe("First risk");

    const empty = normalizePreMortem(null, "I");
    expect(empty.risks).toEqual([]);
    expect(empty.readyToLaunch).toBe(false);
  });
});
