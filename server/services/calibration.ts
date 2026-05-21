/**
 * Calibration Scoring — IMPLEMENTATION_PLAN.md Phase 6, Workstream 6.1
 * MEMORY_AND_LEARNING_REVIEW.md proper-scoring requirements (T10, C25, J3, J4)
 *
 * The learning loop measures how well the platform's probabilistic claims hold
 * up. Proper scoring rules are used so confident hedging cannot game the
 * score:
 *
 *   - Brier score        — mean squared error of probabilistic forecasts.
 *   - Murphy decomposition — Brier = reliability − resolution + uncertainty.
 *       reliability  : how far forecast probabilities sit from observed
 *                      frequencies (lower is better — well-calibrated).
 *       resolution   : how much the forecasts separate outcomes from the base
 *                      rate (HIGHER is better — penalises uninformative
 *                      hedging at the base rate, the J3 Goodhart trap).
 *       uncertainty  : the irreducible difficulty of the outcome set.
 *   - Calibration curve  — predicted vs. observed frequency, binned.
 *
 * Real and synthetic outcomes are scored SEPARATELY (J4) — war-game and other
 * synthetic closes never contaminate the real-world calibration record.
 *
 * The functions here are pure. The cron that resolves outcomes and persists
 * the scorecard depends on KPI sync — Workstream 6.1 cron, infra-gated.
 */

import { eq, and, isNotNull } from "drizzle-orm";
import { getDb } from "../db";
import { predictions, outcomes } from "../../drizzle/schema";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface CalibrationRecord {
  /** The forecast probability, 0–1. */
  forecast: number;
  /** The realised outcome — 1 = the claim held, 0 = it did not. */
  outcome: 0 | 1;
  outcomeClass: "real" | "synthetic";
  framework?: string;
  horizon?: string;
}

export interface CalibrationBin {
  /** Lower edge of the bin, e.g. 0.7 for the 0.7–0.8 bin. */
  lower: number;
  upper: number;
  count: number;
  /** Mean forecast of the records in this bin. */
  meanForecast: number;
  /** Observed hit frequency of the records in this bin. */
  observedFrequency: number;
}

export interface CalibrationStratum {
  label: string;
  count: number;
  /** Mean Brier score — lower is better. */
  brier: number;
  /** Reliability component — lower is better. */
  reliability: number;
  /** Resolution component — higher is better. */
  resolution: number;
  /** Uncertainty component — the base-rate difficulty. */
  uncertainty: number;
  /** Fraction where the more-likely side was the realised outcome. */
  hitRate: number;
}

export interface CalibrationScorecard {
  /** Overall real-world calibration. */
  real: CalibrationStratum;
  /** Overall synthetic (war-game etc.) calibration — kept separate (J4). */
  synthetic: CalibrationStratum;
  /** Real-world calibration split by framework. */
  byFramework: CalibrationStratum[];
  /** Real-world calibration split by horizon class. */
  byHorizon: CalibrationStratum[];
  /** Real-world calibration curve. */
  curve: CalibrationBin[];
}

const DEFAULT_BINS = 10;

// ─────────────────────────────────────────────────────────────────────────────
// PURE SCORING
// ─────────────────────────────────────────────────────────────────────────────

function clampProb(n: number): number {
  if (!Number.isFinite(n)) return 0.5;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

/** Brier score for a single probabilistic forecast — (forecast − outcome)². Pure. */
export function brierScore(forecast: number, outcome: 0 | 1): number {
  const f = clampProb(forecast);
  return (f - outcome) * (f - outcome);
}

/** Mean Brier score across a set of records. Pure. */
export function meanBrier(records: CalibrationRecord[]): number {
  if (records.length === 0) return 0;
  const total = records.reduce((s, r) => s + brierScore(r.forecast, r.outcome), 0);
  return round4(total / records.length);
}

/**
 * Bin records by forecast probability into a calibration curve. Empty bins are
 * dropped. Pure.
 */
export function calibrationCurve(
  records: CalibrationRecord[],
  binCount: number = DEFAULT_BINS,
): CalibrationBin[] {
  const bins = Math.max(2, Math.min(binCount, 20));
  const width = 1 / bins;
  const out: CalibrationBin[] = [];

  for (let b = 0; b < bins; b++) {
    const lower = b * width;
    const upper = b === bins - 1 ? 1 : (b + 1) * width;
    const inBin = records.filter((r) => {
      const f = clampProb(r.forecast);
      return b === bins - 1 ? f >= lower && f <= upper : f >= lower && f < upper;
    });
    if (inBin.length === 0) continue;
    const meanForecast = inBin.reduce((s, r) => s + clampProb(r.forecast), 0) / inBin.length;
    const observedFrequency = inBin.reduce((s, r) => s + r.outcome, 0) / inBin.length;
    out.push({
      lower: round4(lower),
      upper: round4(upper),
      count: inBin.length,
      meanForecast: round4(meanForecast),
      observedFrequency: round4(observedFrequency),
    });
  }
  return out;
}

export interface BrierDecomposition {
  brier: number;
  reliability: number;
  resolution: number;
  uncertainty: number;
}

/**
 * Murphy decomposition of the Brier score: Brier = reliability − resolution +
 * uncertainty. Resolution rewards forecasts that separate outcomes from the
 * base rate, so uninformative hedging cannot win on this metric (J3). Pure.
 */
export function brierDecomposition(
  records: CalibrationRecord[],
  binCount: number = DEFAULT_BINS,
): BrierDecomposition {
  if (records.length === 0) {
    return { brier: 0, reliability: 0, resolution: 0, uncertainty: 0 };
  }
  const n = records.length;
  const baseRate = records.reduce((s, r) => s + r.outcome, 0) / n;
  const uncertainty = baseRate * (1 - baseRate);

  const curve = calibrationCurve(records, binCount);
  let reliability = 0;
  let resolution = 0;
  for (const bin of curve) {
    const weight = bin.count / n;
    reliability += weight * (bin.meanForecast - bin.observedFrequency) ** 2;
    resolution += weight * (bin.observedFrequency - baseRate) ** 2;
  }

  return {
    brier: meanBrier(records),
    reliability: round4(reliability),
    resolution: round4(resolution),
    uncertainty: round4(uncertainty),
  };
}

/** Fraction of records where the more-likely forecast side was realised. Pure. */
export function hitRate(records: CalibrationRecord[]): number {
  if (records.length === 0) return 0;
  const hits = records.filter((r) => Math.round(clampProb(r.forecast)) === r.outcome).length;
  return round4(hits / records.length);
}

/** Mean squared error for point predictions. Pure. */
export function meanSquaredError(items: { predicted: number; actual: number }[]): number {
  if (items.length === 0) return 0;
  const total = items.reduce((s, i) => s + (i.predicted - i.actual) ** 2, 0);
  return round4(total / items.length);
}

/** Mean absolute percentage error for point predictions; zero actuals skipped. Pure. */
export function mape(items: { predicted: number; actual: number }[]): number {
  const usable = items.filter((i) => i.actual !== 0 && Number.isFinite(i.actual));
  if (usable.length === 0) return 0;
  const total = usable.reduce(
    (s, i) => s + Math.abs((i.predicted - i.actual) / i.actual),
    0,
  );
  return round4((total / usable.length) * 100);
}

function stratum(label: string, records: CalibrationRecord[]): CalibrationStratum {
  const d = brierDecomposition(records);
  return {
    label,
    count: records.length,
    brier: d.brier,
    reliability: d.reliability,
    resolution: d.resolution,
    uncertainty: d.uncertainty,
    hitRate: hitRate(records),
  };
}

/**
 * Build a full calibration scorecard. Real and synthetic outcomes are scored
 * in separate strata so synthetic closes never contaminate the real record
 * (J4). The framework / horizon splits cover real outcomes only. Pure.
 */
export function computeScorecard(records: CalibrationRecord[]): CalibrationScorecard {
  const real = records.filter((r) => r.outcomeClass === "real");
  const synthetic = records.filter((r) => r.outcomeClass === "synthetic");

  const groupBy = (key: (r: CalibrationRecord) => string | undefined) => {
    const groups = new Map<string, CalibrationRecord[]>();
    for (const r of real) {
      const k = key(r);
      if (!k) continue;
      const list = groups.get(k) ?? [];
      list.push(r);
      groups.set(k, list);
    }
    return Array.from(groups.entries())
      .map(([label, list]) => stratum(label, list))
      .sort((a, b) => b.count - a.count);
  };

  return {
    real: stratum("real", real),
    synthetic: stratum("synthetic", synthetic),
    byFramework: groupBy((r) => r.framework),
    byHorizon: groupBy((r) => r.horizon),
    curve: calibrationCurve(real),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// DB → CALIBRATION RECORDS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Derive the realised binary outcome from a forecast and the closed outcome's
 * `errorDelta`, which the ledger records as |forecast − outcome|. Picks the
 * outcome (0 or 1) whose implied errorDelta is closest to the recorded one.
 * Returns null when there is no scorable errorDelta.
 */
export function deriveOutcome(forecast: number, errorDelta: number | null | undefined): 0 | 1 | null {
  if (errorDelta == null || !Number.isFinite(errorDelta)) return null;
  const f = clampProb(forecast);
  const ed = Math.min(1, Math.max(0, errorDelta));
  const distTo1 = Math.abs(ed - (1 - f));
  const distTo0 = Math.abs(ed - f);
  return distTo1 <= distTo0 ? 1 : 0;
}

/**
 * Build calibration records for a company from its closed predictions. Joins
 * the prediction ledger to its outcomes; predictions with no scorable outcome
 * are skipped. Returns [] when no database is configured.
 */
export async function getCalibrationRecords(params: {
  tenantId: string;
  companyId: number;
}): Promise<CalibrationRecord[]> {
  const db = await getDb();
  if (!db) return [];

  const rows = await db
    .select({
      confidence: predictions.confidence,
      framework: predictions.framework,
      horizon: predictions.horizon,
      errorDelta: outcomes.errorDelta,
      outcomeClass: outcomes.outcomeClass,
    })
    .from(predictions)
    .innerJoin(outcomes, eq(predictions.outcomeId, outcomes.id))
    .where(
      and(
        eq(predictions.tenantId, params.tenantId),
        eq(predictions.companyId, params.companyId),
        isNotNull(predictions.outcomeId),
      ),
    );

  const records: CalibrationRecord[] = [];
  for (const row of rows) {
    const forecast = clampProb(Number(row.confidence));
    const outcome = deriveOutcome(forecast, row.errorDelta);
    if (outcome === null) continue;
    records.push({
      forecast,
      outcome,
      outcomeClass: row.outcomeClass === "synthetic" ? "synthetic" : "real",
      framework: row.framework ?? undefined,
      horizon: row.horizon ?? undefined,
    });
  }
  return records;
}
