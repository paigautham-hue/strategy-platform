/**
 * Unit tests — Strategic Management normalisers (server/services/strategy-management.ts)
 * + Digital Twin completeness row (server/services/digital-twin-store.ts)
 * Phase 5 / Phase 1 — salvaged from StrategyForge / Dynamo. Pure logic only.
 */

import { describe, it, expect } from "vitest";
import {
  mapKpiCategory,
  computeRiskScore,
  normalizeKpi,
  normalizeMilestone,
  normalizeRisk,
  normalizeStrategicItems,
} from "../services/strategy-management";
import { completenessRow } from "../services/digital-twin-store";
import { scoreDimensionCoverage } from "../services/digital-twin";

describe("strategy-management — KPI category mapping (StrategyForge rules)", () => {
  it("maps free-text categories onto the enum", () => {
    expect(mapKpiCategory("efficiency")).toBe("operational");
    expect(mapKpiCategory("technical")).toBe("operational");
    expect(mapKpiCategory("competitive")).toBe("market");
    expect(mapKpiCategory("revenue growth")).toBe("financial"); // financial wins on "revenue"
    expect(mapKpiCategory("talent")).toBe("organizational");
    expect(mapKpiCategory("something else")).toBe("operational"); // default
  });
});

describe("strategy-management — risk scoring", () => {
  it("computes probability × impact ÷ 100, clamped", () => {
    expect(computeRiskScore(50, 80)).toBe(40);
    expect(computeRiskScore(100, 100)).toBe(100);
    expect(computeRiskScore(150, 50)).toBe(50); // probability clamped to 100
    expect(computeRiskScore(-10, 50)).toBe(0); // clamped to 0
  });

  it("normalizeRisk fills probability/impact/score and keeps mitigation", () => {
    const r = normalizeRisk({ title: "Supplier concentration", probability: 60, impact: 70, mitigation: "Onboard mills" });
    expect(r).toEqual({
      title: "Supplier concentration",
      description: null,
      probability: 60,
      impact: 70,
      riskScore: 42,
      mitigation: "Onboard mills",
    });
  });

  it("coerces numeric-string probability/impact (strict:false LLM output)", () => {
    const r = normalizeRisk({ title: "Supplier", probability: "60", impact: "70" });
    expect(r.probability).toBe(60);
    expect(r.impact).toBe(70);
    expect(r.riskScore).toBe(42);
  });
});

describe("strategy-management — item normalisers", () => {
  it("normalizes a KPI with defaults", () => {
    const k = normalizeKpi({ label: "Export revenue", target: 200, unit: "₹ Cr", category: "growth" });
    expect(k.label).toBe("Export revenue");
    expect(k.target).toBe(200);
    expect(k.current).toBeNull();
    expect(k.unit).toBe("₹ Cr");
    expect(k.category).toBe("market"); // "growth" → market
    expect(k.status).toBe("unknown");
  });

  it("coerces a numeric-string KPI target", () => {
    expect(normalizeKpi({ label: "X", target: "200" }).target).toBe(200);
    expect(normalizeKpi({ label: "Y", target: "" }).target).toBeNull();
  });

  it("normalizes a milestone status (spaces/underscores tolerated)", () => {
    expect(normalizeMilestone({ title: "Noida live", status: "in progress" }).status).toBe("in-progress");
    expect(normalizeMilestone({ title: "x", status: "bogus" }).status).toBe("planned");
  });

  it("resolves common status synonyms, not just exact tokens", () => {
    expect(normalizeMilestone({ title: "x", status: "completed" }).status).toBe("done");
    expect(normalizeMilestone({ title: "x", status: "ongoing" }).status).toBe("in-progress");
    expect(normalizeMilestone({ title: "x", status: "delayed" }).status).toBe("missed");
    expect(normalizeKpi({ label: "x", status: "green" }).status).toBe("on-track");
    expect(normalizeKpi({ label: "x", status: "off-track!" }).status).toBe("off-track");
    expect(normalizeKpi({ label: "x", status: "red" }).status).toBe("off-track");
  });

  it("handles trailing whitespace and multi-word status phrasings", () => {
    expect(normalizeMilestone({ title: "x", status: "done " }).status).toBe("done"); // trailing space
    expect(normalizeKpi({ label: "x", status: "on-track " }).status).toBe("on-track");
    expect(normalizeMilestone({ title: "x", status: "done in Q2" }).status).toBe("done");
    expect(normalizeMilestone({ title: "x", status: "completed 2025" }).status).toBe("done");
    expect(normalizeKpi({ label: "x", status: "behind schedule" }).status).toBe("off-track");
    // enum-prefix + non-leading-token resolution
    expect(normalizeKpi({ label: "x", status: "on track for Q2" }).status).toBe("on-track");
    expect(normalizeMilestone({ title: "x", status: "in progress, on schedule" }).status).toBe("in-progress");
    expect(normalizeKpi({ label: "x", status: "high risk" }).status).toBe("at-risk");
    // negation must never flip to the positive token it contains
    expect(normalizeMilestone({ title: "x", status: "not yet started" }).status).toBe("planned");
    expect(normalizeMilestone({ title: "x", status: "not started yet" }).status).toBe("planned");
    expect(normalizeMilestone({ title: "x", status: "not done yet" }).status).toBe("planned");
    expect(normalizeMilestone({ title: "x", status: "not complete" }).status).toBe("planned");
    expect(normalizeKpi({ label: "x", status: "not at risk" }).status).toBe("unknown");
    // multi-token enum value embedded mid-phrase
    expect(normalizeMilestone({ title: "x", status: "work in progress" }).status).toBe("in-progress");
    expect(normalizeMilestone({ title: "x", status: "on schedule, in progress" }).status).toBe("in-progress");
    expect(normalizeMilestone({ title: "x", status: "no, in progress" }).status).toBe("in-progress"); // bare "no" isn't negation
    expect(normalizeMilestone({ title: "x", status: "deal won, shipped" }).status).toBe("done"); // bare "won" isn't negation
    expect(normalizeMilestone({ title: "x", status: "won't start yet" }).status).toBe("planned"); // contraction IS negation
    // generic n't contractions negate (must not flip to the positive token)
    expect(normalizeMilestone({ title: "x", status: "hasn't started" }).status).toBe("planned");
    expect(normalizeMilestone({ title: "x", status: "wasn't done" }).status).toBe("planned");
    expect(normalizeKpi({ label: "x", status: "wasn't good" }).status).toBe("unknown");
    expect(normalizeMilestone({ title: "x", status: "cannot start" }).status).toBe("planned");
  });

  it("caps bounded strings to their column widths (MySQL strict-mode safety)", () => {
    const k = normalizeKpi({ label: "L".repeat(300), unit: "U".repeat(50) });
    expect(k.label.length).toBe(255);
    expect(k.unit?.length).toBe(32);
    const m = normalizeMilestone({ title: "T".repeat(300), quarter: "Q".repeat(20), fiscalYear: "F".repeat(20) });
    expect(m.title.length).toBe(255);
    expect(m.quarter?.length).toBe(16);
    expect(m.fiscalYear?.length).toBe(16);
  });

  it("drops untitled rows and bounds the set", () => {
    const items = normalizeStrategicItems({
      kpis: [{ label: "A" }, { label: "" }, { notALabel: 1 }],
      milestones: [{ title: "M" }, {}],
      risks: [{ title: "R", probability: 40, impact: 50 }],
    });
    expect(items.kpis).toHaveLength(1);
    expect(items.milestones).toHaveLength(1);
    expect(items.risks).toHaveLength(1);
    expect(items.risks[0].riskScore).toBe(20);
  });

  it("returns empty sets for junk input", () => {
    expect(normalizeStrategicItems(null)).toEqual({ kpis: [], milestones: [], risks: [] });
  });
});

describe("digital-twin-store — completeness row (pure)", () => {
  it("flattens coverage into a row with overall = mean", () => {
    const coverage = scoreDimensionCoverage([
      { role: "user", content: "We sell to customers; our value proposition and competitive positioning are clear." },
    ]);
    const row = completenessRow(coverage);
    expect(row.businessModel).toBe(100);
    expect(row.financials).toBe(0);
    expect(row.overall).toBe(20); // mean of [100,0,0,0,0]
  });
});
