/**
 * Unit tests — Drift Detection + Replan Engine (server/agents/drift.ts)
 * IMPLEMENTATION_PLAN.md Phase 5 / Workstream 5.4
 */

import { describe, it, expect } from "vitest";
import {
  scheduleDrift,
  kpiDrift,
  thesisDrift,
  overallSeverity,
  detectDrift,
  needsReplan,
  normalizeReplan,
} from "../agents/drift";

describe("drift — scheduleDrift", () => {
  it("classifies on-track, slipping, and behind", () => {
    expect(scheduleDrift({ plannedProgress: 0.5, actualProgress: 0.48 }).status).toBe("on-track");
    expect(scheduleDrift({ plannedProgress: 0.5, actualProgress: 0.35 }).status).toBe("slipping");
    expect(scheduleDrift({ plannedProgress: 0.8, actualProgress: 0.3 }).status).toBe("behind");
  });

  it("reports ahead of plan as negative drift", () => {
    const d = scheduleDrift({ plannedProgress: 0.4, actualProgress: 0.6 });
    expect(d.status).toBe("ahead");
    expect(d.driftPct).toBe(-20);
  });
});

describe("drift — kpiDrift", () => {
  it("returns insufficient-data below the minimum sample size", () => {
    const d = kpiDrift({ expected: 100, actual: 50, sampleSize: 5 });
    expect(d.status).toBe("insufficient-data");
  });

  it("treats favourable divergence as on-track", () => {
    const d = kpiDrift({ expected: 100, actual: 140, sampleSize: 40, higherIsBetter: true });
    expect(d.favorable).toBe(true);
    expect(d.status).toBe("on-track");
  });

  it("flags adverse divergence by magnitude", () => {
    expect(kpiDrift({ expected: 100, actual: 92, sampleSize: 40 }).status).toBe("on-track");
    expect(kpiDrift({ expected: 100, actual: 80, sampleSize: 40 }).status).toBe("diverging");
    expect(kpiDrift({ expected: 100, actual: 50, sampleSize: 40 }).status).toBe("off-track");
  });

  it("honours higherIsBetter = false", () => {
    const d = kpiDrift({ expected: 100, actual: 60, sampleSize: 40, higherIsBetter: false });
    expect(d.favorable).toBe(true);
    expect(d.status).toBe("on-track");
  });
});

describe("drift — thesisDrift", () => {
  it("classifies stable, questioned, and invalidated", () => {
    expect(thesisDrift(1).status).toBe("stable");
    expect(thesisDrift(3).status).toBe("questioned");
    expect(thesisDrift(6).status).toBe("invalidated");
  });

  it("respects a custom threshold", () => {
    expect(thesisDrift(2, 2).status).toBe("questioned");
    expect(thesisDrift(4, 2).status).toBe("invalidated");
  });
});

describe("drift — overallSeverity + detectDrift", () => {
  it("rolls up to alert when any detector is at its worst", () => {
    const report = detectDrift({
      schedule: { plannedProgress: 0.8, actualProgress: 0.3 },
      kpi: { expected: 100, actual: 100, sampleSize: 40 },
      contradictionCount: 0,
    });
    expect(report.severity).toBe("alert");
    expect(needsReplan(report)).toBe(true);
  });

  it("rolls up to none when everything is on-track", () => {
    const report = detectDrift({
      schedule: { plannedProgress: 0.5, actualProgress: 0.5 },
      kpi: { expected: 100, actual: 100, sampleSize: 40 },
      contradictionCount: 0,
    });
    expect(report.severity).toBe("none");
    expect(needsReplan(report)).toBe(false);
  });

  it("overallSeverity returns watch for a slipping schedule", () => {
    expect(
      overallSeverity(
        { driftPct: 12, status: "slipping" },
        { divergencePct: 0, favorable: true, status: "on-track" },
        { contradictionCount: 0, status: "stable" },
      ),
    ).toBe("watch");
  });
});

describe("drift — normalizeReplan", () => {
  it("normalizes a well-formed replan proposal", () => {
    const p = normalizeReplan({
      recommendation: "pivot",
      rationale: "The leading indicator has collapsed.",
      adjustments: ["Re-scope to the core segment"],
    });
    expect(p.recommendation).toBe("pivot");
    expect(p.adjustments).toHaveLength(1);
  });

  it("defaults an unknown recommendation to adjust-pace", () => {
    expect(normalizeReplan({ recommendation: "panic", rationale: "x" }).recommendation).toBe(
      "adjust-pace",
    );
  });

  it("supplies fallbacks for a non-object payload", () => {
    const p = normalizeReplan(null);
    expect(p.recommendation).toBe("adjust-pace");
    expect(p.rationale).toBe("No rationale was produced.");
    expect(p.adjustments).toEqual([]);
  });
});
