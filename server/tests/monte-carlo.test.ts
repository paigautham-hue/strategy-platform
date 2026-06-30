/**
 * Unit tests — Monte Carlo Financial Simulation (server/services/monte-carlo.ts)
 * IMPLEMENTATION_PLAN.md Phase 2 (financial modelling). Salvaged from StrategyForge.
 *
 * The engine is seeded, so these assert EXACT values, not ranges.
 */

import { describe, it, expect } from "vitest";
import {
  npv,
  irr,
  runMonteCarlo,
  runSensitivity,
  runScenarioComparison,
  type MonteCarloInput,
} from "../services/monte-carlo";

// A zero-volatility projection is fully deterministic regardless of seed, so its
// NPV can be hand-computed and asserted exactly.
//   Yr0: 100 ×1.10 = 110 rev, 50% margin, 0% tax → 55 net income
//   Yr1: 110 ×1.10 = 121 rev, 50% margin, 0% tax → 60.5 net income
//   Terminal (cap rate 10%): 60.5 / 0.10 = 605 → added to Yr1 → 665.5
//   NPV@10%: 55/1.1 + 665.5/1.21 = 50 + 550 = 600
const ZERO_VOL: MonteCarloInput = {
  baseRevenue: 100,
  growthRates: [10, 10],
  ebitdaMargin: 50,
  taxRate: 0,
  discountRate: 10,
  terminalGrowthRate: 0,
  revenueVolatility: 0,
  marginVolatility: 0,
  growthVolatility: 0,
};

const VOLATILE: MonteCarloInput = {
  baseRevenue: 1000,
  growthRates: [15, 12, 10],
  ebitdaMargin: 25,
  taxRate: 20,
  discountRate: 12,
  terminalGrowthRate: 3,
  revenueVolatility: 8,
  marginVolatility: 5,
  growthVolatility: 6,
};

describe("monte-carlo — pure npv / irr", () => {
  it("npv discounts period cash flows correctly", () => {
    expect(npv([55, 665.5], 10)).toBeCloseTo(600, 6);
    expect(npv([100], 0)).toBe(100);
  });

  it("irr is self-consistent: npv at the IRR is ~0", () => {
    const flows = [-500, 300, 400];
    const r = irr(flows);
    expect(r).not.toBeNull();
    expect(Math.abs(npv(flows, r as number))).toBeLessThan(1);
  });

  it("irr returns null on a degenerate (no-root) cash-flow stream", () => {
    expect(irr([])).toBeNull();
    expect(irr([0, 0])).toBeNull();
  });

  it("npv guards a -100% discount rate instead of leaking Infinity", () => {
    expect(Number.isNaN(npv([100, 200], -100))).toBe(true);
    expect(Number.isFinite(npv([100, 200], 10))).toBe(true);
  });
});

describe("monte-carlo — deterministic zero-volatility path", () => {
  const r = runMonteCarlo(ZERO_VOL, { numSimulations: 50 });

  it("mean NPV equals the hand-computed 600", () => {
    expect(r.statistics.meanNPV).toBe(600);
  });

  it("has zero dispersion and no downside", () => {
    expect(r.statistics.stdDevNPV).toBe(0);
    expect(r.riskMetrics.probabilityOfLoss).toBe(0);
    expect(r.riskMetrics.sharpeRatio).toBeNull(); // undefined with zero variance
  });

  it("every percentile collapses to the deterministic NPV", () => {
    expect(r.percentiles).toEqual({ p10: 600, p25: 600, p50: 600, p75: 600, p90: 600 });
  });

  it("reports mean revenue per projected year", () => {
    expect(r.statistics.meanRevenue).toEqual([110, 121]);
    expect(r.meta.years).toBe(2);
  });
});

describe("monte-carlo — stochastic behaviour", () => {
  it("is fully deterministic for a fixed seed", () => {
    const a = runMonteCarlo(VOLATILE, { seed: 7, numSimulations: 2000 });
    const b = runMonteCarlo(VOLATILE, { seed: 7, numSimulations: 2000 });
    expect(a).toEqual(b);
  });

  it("different seeds produce different distributions", () => {
    const a = runMonteCarlo(VOLATILE, { seed: 1, numSimulations: 2000 });
    const b = runMonteCarlo(VOLATILE, { seed: 2, numSimulations: 2000 });
    expect(a.statistics.meanNPV).not.toBe(b.statistics.meanNPV);
  });

  it("produces monotonically ordered percentiles", () => {
    const { percentiles: p } = runMonteCarlo(VOLATILE, { seed: 3, numSimulations: 3000 });
    expect(p.p10).toBeLessThanOrEqual(p.p25);
    expect(p.p25).toBeLessThanOrEqual(p.p50);
    expect(p.p50).toBeLessThanOrEqual(p.p75);
    expect(p.p75).toBeLessThanOrEqual(p.p90);
  });

  it("keeps probability of loss in [0, 1]", () => {
    const { riskMetrics } = runMonteCarlo(VOLATILE, { seed: 4, numSimulations: 2000 });
    expect(riskMetrics.probabilityOfLoss).toBeGreaterThanOrEqual(0);
    expect(riskMetrics.probabilityOfLoss).toBeLessThanOrEqual(1);
    expect(riskMetrics.valueAtRisk99).toBeLessThanOrEqual(riskMetrics.valueAtRisk95);
  });
});

describe("monte-carlo — sensitivity + scenarios", () => {
  it("sensitivity returns steps+1 points and rises with base revenue", () => {
    const pts = runSensitivity(
      VOLATILE,
      "baseRevenue",
      { min: 500, max: 2000, steps: 5 },
      { numSimulations: 500, seed: 9 },
    );
    expect(pts.length).toBe(6);
    expect(pts[pts.length - 1].meanNPV).toBeGreaterThan(pts[0].meanNPV);
  });

  it("best case dominates base, which dominates worst", () => {
    const { bestCase, baseCase, worstCase } = runScenarioComparison(VOLATILE, {
      numSimulations: 1500,
      seed: 11,
    });
    expect(bestCase.statistics.meanNPV).toBeGreaterThanOrEqual(baseCase.statistics.meanNPV);
    expect(baseCase.statistics.meanNPV).toBeGreaterThanOrEqual(worstCase.statistics.meanNPV);
  });
});
