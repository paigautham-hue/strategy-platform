/**
 * Monte Carlo Financial Simulation — IMPLEMENTATION_PLAN.md Phase 2 (financial modelling)
 *
 * Probabilistic NPV / IRR / risk analysis over a multi-year revenue projection.
 * Salvaged and hardened from the StrategyForge prototype
 * (server/monteCarloSimulation.ts) during the prototype-consolidation pass, then
 * adapted to this project's conventions. It partially fills the Phase 2
 * "code interpreter / financial modelling" gap with a real, dependency-free
 * computational core the reasoning agents can call for option valuation.
 *
 * Two deliberate changes from the donor:
 *   1. The RNG is a SEEDED, pure mulberry32 generator (not global Math.random),
 *      so a given (input, seed) always yields the same distribution. Determinism
 *      is what makes the output unit-testable AND auditable — the same forecast
 *      can be reproduced when its prediction-ledger entry (C2) is later resolved.
 *   2. Edge cases that produced NaN/Infinity in the donor (log(0) in Box-Muller,
 *      a non-positive cap-rate denominator, a zero-variance Sharpe ratio) are
 *      guarded and return null rather than poisoning the statistics.
 *
 * Everything here is pure and deterministic — fully unit-tested.
 */

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface MonteCarloInput {
  /** Starting (year-0) revenue, in absolute currency units. */
  baseRevenue: number;
  /** Per-year expected growth rate, as a percentage (e.g. 20 = +20%). Length sets the horizon. */
  growthRates: number[];
  /** EBITDA margin, as a percentage of revenue. */
  ebitdaMargin: number;
  /** Effective tax rate, as a percentage. */
  taxRate: number;
  /** Discount rate for NPV, as a percentage. */
  discountRate: number;
  /** Perpetuity growth rate for the terminal value, as a percentage. */
  terminalGrowthRate: number;
  /** Revenue noise, as a percentage standard deviation. */
  revenueVolatility: number;
  /** Margin noise, as a percentage standard deviation. */
  marginVolatility: number;
  /** Growth noise, as a percentage standard deviation. */
  growthVolatility: number;
}

export interface MonteCarloOptions {
  /** Number of simulated paths. Default 10,000. */
  numSimulations?: number;
  /** PRNG seed — same seed + input ⇒ identical output. Default 1. */
  seed?: number;
}

export interface MonteCarloStatistics {
  meanNPV: number;
  medianNPV: number;
  stdDevNPV: number;
  /** Mean modelled revenue per projected year. */
  meanRevenue: number[];
}

export interface MonteCarloPercentiles {
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
}

export interface MonteCarloRiskMetrics {
  /** Share of paths with a negative NPV, in [0, 1]. */
  probabilityOfLoss: number;
  /** 5th-percentile NPV (95% Value at Risk). */
  valueAtRisk95: number;
  /** 1st-percentile NPV (99% Value at Risk). */
  valueAtRisk99: number;
  /** Mean NPV of the worst 5% of paths (CVaR / expected shortfall). */
  expectedShortfall: number;
  /** Reward-per-unit-risk; null when there is no variance to divide by. */
  sharpeRatio: number | null;
}

export interface MonteCarloResult {
  statistics: MonteCarloStatistics;
  percentiles: MonteCarloPercentiles;
  riskMetrics: MonteCarloRiskMetrics;
  meta: { numSimulations: number; seed: number; years: number };
}

// ─────────────────────────────────────────────────────────────────────────────
// PURE NUMERIC HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** mulberry32 — a tiny, fast, deterministic PRNG. Returns a [0, 1) generator. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Box-Muller normal sample from a supplied uniform RNG. Guards u1 = 0 (log(0)). */
function randomNormal(rng: () => number, mean: number, stdDev: number): number {
  let u1 = rng();
  while (u1 <= 0) u1 = rng(); // avoid log(0) = -Infinity
  const u2 = rng();
  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return mean + z0 * stdDev;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Nearest-rank percentile of an already-ascending-sorted array. The nearest-rank
 * value sits at 0-indexed position ceil(n*p) - 1 (using floor(n*p) would bias
 * every percentile one rank too high — and make the lower-tail VaR less
 * conservative, which is the wrong direction for a risk number).
 */
function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return NaN;
  const idx = Math.min(sortedAsc.length - 1, Math.max(0, Math.ceil(sortedAsc.length * p) - 1));
  return sortedAsc[idx];
}

/** Net present value of period cash flows (period 1..n) at a percentage discount rate. */
export function npv(cashFlows: number[], discountRatePct: number): number {
  // A discount rate of -100% (or below) makes (1 + r) ≤ 0 and divides by zero,
  // leaking Infinity/NaN into the statistics — guard the degenerate base.
  if (discountRatePct <= -100) return NaN;
  const r = discountRatePct / 100;
  return cashFlows.reduce((acc, cf, i) => acc + cf / Math.pow(1 + r, i + 1), 0);
}

/**
 * Internal rate of return via Newton-Raphson, returned as a percentage.
 * Returns null when the derivative vanishes or the iteration fails to converge —
 * the donor returned a meaningless number in those cases.
 */
export function irr(cashFlows: number[], initialGuess = 0.1): number | null {
  const maxIterations = 100;
  const tolerance = 1e-7;
  let rate = initialGuess;

  for (let i = 0; i < maxIterations; i++) {
    let value = 0;
    let derivative = 0;
    for (let year = 0; year < cashFlows.length; year++) {
      const factor = Math.pow(1 + rate, year + 1);
      value += cashFlows[year] / factor;
      derivative -= ((year + 1) * cashFlows[year]) / (factor * (1 + rate));
    }
    if (!Number.isFinite(derivative) || Math.abs(derivative) < 1e-12) return null;
    const next = rate - value / derivative;
    if (!Number.isFinite(next)) return null;
    if (Math.abs(next - rate) < tolerance) return round2(next * 100);
    rate = next;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// CORE SIMULATION
// ─────────────────────────────────────────────────────────────────────────────

/** Project one revenue/EBITDA/net-income path and return its discounted NPV. */
function simulateOnePath(
  input: MonteCarloInput,
  rng: () => number,
  revenuesOut: number[],
): number {
  const years = input.growthRates.length;
  const netIncome: number[] = [];
  let currentRevenue = input.baseRevenue;

  for (let year = 0; year < years; year++) {
    const baseGrowth = input.growthRates[year] ?? 0;
    const actualGrowth = baseGrowth + randomNormal(rng, 0, input.growthVolatility);
    currentRevenue = currentRevenue * (1 + actualGrowth / 100);

    const revenueNoise = randomNormal(rng, 0, input.revenueVolatility);
    const actualRevenue = currentRevenue * (1 + revenueNoise / 100);

    const actualMargin = Math.max(0, input.ebitdaMargin + randomNormal(rng, 0, input.marginVolatility));
    const yearEbitda = actualRevenue * (actualMargin / 100);
    const yearNetIncome = yearEbitda * (1 - input.taxRate / 100);

    revenuesOut[year] += actualRevenue;
    netIncome.push(yearNetIncome);
  }

  // Terminal value via the Gordon growth model; guarded against a non-positive
  // cap rate (discount ≤ terminal growth), which would otherwise blow up.
  const cashFlows = [...netIncome];
  const capRate = (input.discountRate - input.terminalGrowthRate) / 100;
  if (capRate > 0 && years > 0) {
    const terminalCashFlow = netIncome[years - 1] * (1 + input.terminalGrowthRate / 100);
    cashFlows[years - 1] += terminalCashFlow / capRate;
  }

  return npv(cashFlows, input.discountRate);
}

/**
 * Run a Monte Carlo simulation over the projection and return its distribution
 * statistics, percentiles and risk metrics. Pure and deterministic for a given
 * (input, seed).
 */
export function runMonteCarlo(input: MonteCarloInput, opts: MonteCarloOptions = {}): MonteCarloResult {
  const numSimulations = Math.max(1, Math.floor(opts.numSimulations ?? 10_000));
  const seed = opts.seed ?? 1;
  const years = input.growthRates.length;
  const rng = mulberry32(seed);

  const npvs: number[] = new Array(numSimulations);
  const revenueSums: number[] = new Array(years).fill(0);

  for (let sim = 0; sim < numSimulations; sim++) {
    npvs[sim] = simulateOnePath(input, rng, revenueSums);
  }

  const sorted = [...npvs].sort((a, b) => a - b);
  const meanNPV = npvs.reduce((s, v) => s + v, 0) / numSimulations;
  const medianNPV = percentile(sorted, 0.5);
  const variance = npvs.reduce((s, v) => s + (v - meanNPV) ** 2, 0) / numSimulations;
  const stdDevNPV = Math.sqrt(variance);

  const meanRevenue = revenueSums.map((sum) => round2(sum / numSimulations));

  const worstCount = Math.max(1, Math.floor(numSimulations * 0.05));
  const expectedShortfall =
    sorted.slice(0, worstCount).reduce((s, v) => s + v, 0) / worstCount;

  const sharpeRatio =
    stdDevNPV === 0 || input.baseRevenue === 0
      ? null
      : round2((meanNPV / input.baseRevenue - 0.03) / (stdDevNPV / input.baseRevenue));

  return {
    statistics: {
      meanNPV: round2(meanNPV),
      medianNPV: round2(medianNPV),
      stdDevNPV: round2(stdDevNPV),
      meanRevenue,
    },
    percentiles: {
      p10: round2(percentile(sorted, 0.1)),
      p25: round2(percentile(sorted, 0.25)),
      p50: round2(medianNPV),
      p75: round2(percentile(sorted, 0.75)),
      p90: round2(percentile(sorted, 0.9)),
    },
    riskMetrics: {
      // A [0,1] tail probability — round to 4 dp, not 2, so a 0.4% loss chance
      // (40 of 10,000 paths) isn't flattened to 0.00.
      probabilityOfLoss: Math.round((npvs.filter((v) => v < 0).length / numSimulations) * 1e4) / 1e4,
      valueAtRisk95: round2(percentile(sorted, 0.05)),
      valueAtRisk99: round2(percentile(sorted, 0.01)),
      expectedShortfall: round2(expectedShortfall),
      sharpeRatio,
    },
    meta: { numSimulations, seed, years },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SENSITIVITY + SCENARIOS
// ─────────────────────────────────────────────────────────────────────────────

export type SensitivityVariable =
  | "baseRevenue"
  | "ebitdaMargin"
  | "taxRate"
  | "discountRate"
  | "terminalGrowthRate"
  | "revenueVolatility"
  | "marginVolatility"
  | "growthVolatility";

export interface SensitivityPoint {
  value: number;
  meanNPV: number;
}

/**
 * Sweep a single scalar variable across a range and report mean NPV at each step.
 * Uses a reduced path count per step for speed; deterministic for a given seed.
 */
export function runSensitivity(
  input: MonteCarloInput,
  variable: SensitivityVariable,
  range: { min: number; max: number; steps: number },
  opts: MonteCarloOptions = {},
): SensitivityPoint[] {
  const steps = Math.max(1, Math.floor(range.steps));
  const stepSize = (range.max - range.min) / steps;
  const points: SensitivityPoint[] = [];
  for (let i = 0; i <= steps; i++) {
    const value = range.min + i * stepSize;
    const modified: MonteCarloInput = { ...input, [variable]: value };
    const result = runMonteCarlo(modified, { numSimulations: opts.numSimulations ?? 1_000, seed: opts.seed ?? 1 });
    points.push({ value: round2(value), meanNPV: result.statistics.meanNPV });
  }
  return points;
}

export interface ScenarioComparison {
  bestCase: MonteCarloResult;
  baseCase: MonteCarloResult;
  worstCase: MonteCarloResult;
}

/**
 * Generate a best / base / worst comparison by scaling growth up/down and
 * dampening/amplifying revenue volatility. Deterministic for a given seed.
 */
export function runScenarioComparison(input: MonteCarloInput, opts: MonteCarloOptions = {}): ScenarioComparison {
  const sims = opts.numSimulations ?? 2_000;
  const seed = opts.seed ?? 1;
  const best: MonteCarloInput = {
    ...input,
    growthRates: input.growthRates.map((g) => g * 1.5),
    revenueVolatility: input.revenueVolatility * 0.5,
  };
  const worst: MonteCarloInput = {
    ...input,
    growthRates: input.growthRates.map((g) => g * 0.5),
    revenueVolatility: input.revenueVolatility * 1.5,
  };
  return {
    bestCase: runMonteCarlo(best, { numSimulations: sims, seed }),
    baseCase: runMonteCarlo(input, { numSimulations: sims, seed }),
    worstCase: runMonteCarlo(worst, { numSimulations: sims, seed }),
  };
}
