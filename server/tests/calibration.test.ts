/**
 * Unit tests — Calibration Scoring (server/services/calibration.ts)
 * IMPLEMENTATION_PLAN.md Phase 6 / Workstream 6.1
 */

import { describe, it, expect } from "vitest";
import {
  brierScore,
  meanBrier,
  calibrationCurve,
  brierDecomposition,
  hitRate,
  meanSquaredError,
  mape,
  computeScorecard,
  deriveOutcome,
  type CalibrationRecord,
} from "../services/calibration";

const rec = (
  forecast: number,
  outcome: 0 | 1,
  over: Partial<CalibrationRecord> = {},
): CalibrationRecord => ({ forecast, outcome, outcomeClass: "real", ...over });

describe("calibration — brierScore + meanBrier", () => {
  it("scores a single forecast as squared error", () => {
    expect(brierScore(0.8, 1)).toBeCloseTo(0.04);
    expect(brierScore(0.3, 0)).toBeCloseTo(0.09);
    expect(brierScore(1, 0)).toBe(1);
  });

  it("averages Brier across a record set", () => {
    expect(meanBrier([rec(0.9, 1), rec(0.1, 0)])).toBeCloseTo(0.01);
    expect(meanBrier([])).toBe(0);
  });
});

describe("calibration — hitRate", () => {
  it("counts the more-likely side being realised", () => {
    expect(hitRate([rec(0.9, 1), rec(0.8, 0), rec(0.2, 0), rec(0.3, 1)])).toBe(0.5);
    expect(hitRate([])).toBe(0);
  });
});

describe("calibration — calibrationCurve", () => {
  it("bins records and drops empty bins", () => {
    const curve = calibrationCurve([rec(0.92, 1), rec(0.95, 1), rec(0.08, 0)], 10);
    expect(curve).toHaveLength(2);
    const top = curve.find((b) => b.lower >= 0.9)!;
    expect(top.count).toBe(2);
    expect(top.observedFrequency).toBe(1);
  });
});

describe("calibration — brierDecomposition", () => {
  it("computes uncertainty from the base rate", () => {
    const d = brierDecomposition([rec(0.6, 1), rec(0.4, 1), rec(0.6, 0), rec(0.4, 0)]);
    expect(d.uncertainty).toBeCloseTo(0.25);
  });

  it("rewards sharp, well-calibrated forecasts with high resolution and low reliability", () => {
    const records: CalibrationRecord[] = [
      ...Array(10).fill(null).map(() => rec(0.9, 1)),
      ...Array(10).fill(null).map(() => rec(0.1, 0)),
    ];
    const d = brierDecomposition(records);
    expect(d.resolution).toBeCloseTo(0.25);
    expect(d.reliability).toBeCloseTo(0.01);
    expect(d.uncertainty).toBeCloseTo(0.25);
    // Murphy identity holds when within-bin forecasts are identical.
    expect(d.reliability - d.resolution + d.uncertainty).toBeCloseTo(d.brier);
  });
});

describe("calibration — point-prediction scores", () => {
  it("computes mean squared error", () => {
    expect(
      meanSquaredError([
        { predicted: 10, actual: 12 },
        { predicted: 5, actual: 5 },
      ]),
    ).toBe(2);
  });

  it("computes MAPE and skips zero actuals", () => {
    expect(
      mape([
        { predicted: 90, actual: 100 },
        { predicted: 0, actual: 0 },
      ]),
    ).toBeCloseTo(10);
  });
});

describe("calibration — computeScorecard", () => {
  it("keeps real and synthetic outcomes in separate strata (J4)", () => {
    const card = computeScorecard([
      rec(0.9, 1, { framework: "swot", horizon: "short" }),
      rec(0.8, 0, { framework: "swot", horizon: "short", outcomeClass: "synthetic" }),
      rec(0.7, 1, { framework: "porter", horizon: "long" }),
    ]);
    expect(card.real.count).toBe(2);
    expect(card.synthetic.count).toBe(1);
    expect(card.byFramework.map((s) => s.label).sort()).toEqual(["porter", "swot"]);
    expect(card.byHorizon.map((s) => s.label).sort()).toEqual(["long", "short"]);
  });

  it("handles an empty record set", () => {
    const card = computeScorecard([]);
    expect(card.real.count).toBe(0);
    expect(card.synthetic.count).toBe(0);
    expect(card.curve).toEqual([]);
  });
});

describe("calibration — deriveOutcome", () => {
  it("recovers the binary outcome from forecast + errorDelta", () => {
    expect(deriveOutcome(0.8, 0.2)).toBe(1);
    expect(deriveOutcome(0.8, 0.8)).toBe(0);
    expect(deriveOutcome(0.3, 0.3)).toBe(0);
    expect(deriveOutcome(0.3, 0.7)).toBe(1);
  });

  it("returns null when there is no scorable errorDelta", () => {
    expect(deriveOutcome(0.5, null)).toBeNull();
    expect(deriveOutcome(0.5, undefined)).toBeNull();
  });
});
