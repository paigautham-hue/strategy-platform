/**
 * Drift Detection + Replan Engine — IMPLEMENTATION_PLAN.md Phase 5, Workstream 5.4
 *
 * Three detectors watch an active initiative for divergence from plan:
 *   - schedule drift — actual progress vs. planned progress
 *   - KPI drift      — a leading indicator vs. its expected value, gated on a
 *                      minimum sample size so noise never trips an alert
 *   - thesis drift   — the underlying assumption invalidated, measured by the
 *                      count of contradictions against it
 *
 * The three detectors are PURE functions — deterministic, fully tested, and
 * the place a synthetic drift fixture exercises end to end. When drift is
 * found, the replan engine proposes Continue / Adjust pace / Pivot / Kill.
 *
 * The nightly drift crons that persist alerts (with hysteresis) depend on
 * KPI sync + connector status — Workstream 5.3, infra-gated.
 */

import * as router from "../ai/router";
import type { RouterContext } from "../ai/router";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type ScheduleStatus = "ahead" | "on-track" | "slipping" | "behind";
export type KpiStatus = "insufficient-data" | "on-track" | "diverging" | "off-track";
export type ThesisStatus = "stable" | "questioned" | "invalidated";
export type DriftSeverity = "none" | "watch" | "alert";

export interface ScheduleDrift {
  /** Percentage points behind plan — negative means ahead. */
  driftPct: number;
  status: ScheduleStatus;
}

export interface KpiDrift {
  /** Signed divergence of actual from expected, as a percentage. */
  divergencePct: number;
  /** Is the divergence in the desired direction? */
  favorable: boolean;
  status: KpiStatus;
}

export interface ThesisDrift {
  contradictionCount: number;
  status: ThesisStatus;
}

export interface DriftReport {
  schedule: ScheduleDrift;
  kpi: KpiDrift;
  thesis: ThesisDrift;
  /** Worst of the three — drives whether a replan is needed. */
  severity: DriftSeverity;
}

export interface ScheduleDriftInput {
  /** Planned progress at this point, 0–1. */
  plannedProgress: number;
  /** Actual progress, 0–1. */
  actualProgress: number;
}

export interface KpiDriftInput {
  /** The expected / target value of the leading indicator. */
  expected: number;
  /** The observed value. */
  actual: number;
  /** How many observations the actual is based on. */
  sampleSize: number;
  /** Minimum sample size before drift is trusted (default 20). */
  minSampleSize?: number;
  /** Is a higher value better? Default true. */
  higherIsBetter?: boolean;
}

const DEFAULT_MIN_SAMPLE = 20;
const DEFAULT_THESIS_THRESHOLD = 3;

// ─────────────────────────────────────────────────────────────────────────────
// PURE DETECTORS
// ─────────────────────────────────────────────────────────────────────────────

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

/** Schedule drift — actual progress vs. planned progress. Pure. */
export function scheduleDrift(input: ScheduleDriftInput): ScheduleDrift {
  const planned = clamp01(input.plannedProgress);
  const actual = clamp01(input.actualProgress);
  const driftPct = Math.round((planned - actual) * 100);

  let status: ScheduleStatus;
  if (driftPct < -2) status = "ahead";
  else if (driftPct <= 5) status = "on-track";
  else if (driftPct <= 20) status = "slipping";
  else status = "behind";

  return { driftPct, status };
}

/**
 * KPI drift — a leading indicator vs. its expected value. Gated on a minimum
 * sample size: below it, the result is "insufficient-data" and never an alert.
 * Favourable divergence is not drift. Pure.
 */
export function kpiDrift(input: KpiDriftInput): KpiDrift {
  const minSample = input.minSampleSize ?? DEFAULT_MIN_SAMPLE;
  const higherIsBetter = input.higherIsBetter ?? true;

  if (!Number.isFinite(input.sampleSize) || input.sampleSize < minSample) {
    return { divergencePct: 0, favorable: true, status: "insufficient-data" };
  }

  const { expected, actual } = input;
  let divergencePct: number;
  if (expected === 0) {
    divergencePct = actual === 0 ? 0 : actual > 0 ? 100 : -100;
  } else {
    divergencePct = Math.round(((actual - expected) / Math.abs(expected)) * 100);
  }

  const favorable = higherIsBetter ? actual >= expected : actual <= expected;
  if (favorable) return { divergencePct, favorable, status: "on-track" };

  const magnitude = Math.abs(divergencePct);
  let status: KpiStatus;
  if (magnitude <= 10) status = "on-track";
  else if (magnitude <= 25) status = "diverging";
  else status = "off-track";

  return { divergencePct, favorable, status };
}

/**
 * Thesis drift — the underlying assumption invalidated, measured by the count
 * of contradictions against it. Pure.
 */
export function thesisDrift(
  contradictionCount: number,
  threshold: number = DEFAULT_THESIS_THRESHOLD,
): ThesisDrift {
  const count = Number.isFinite(contradictionCount) && contradictionCount > 0
    ? Math.floor(contradictionCount)
    : 0;
  let status: ThesisStatus;
  if (count >= threshold * 2) status = "invalidated";
  else if (count >= threshold) status = "questioned";
  else status = "stable";
  return { contradictionCount: count, status };
}

/** Roll the three detectors up into an overall severity. Pure. */
export function overallSeverity(
  schedule: ScheduleDrift,
  kpi: KpiDrift,
  thesis: ThesisDrift,
): DriftSeverity {
  if (schedule.status === "behind" || kpi.status === "off-track" || thesis.status === "invalidated") {
    return "alert";
  }
  if (schedule.status === "slipping" || kpi.status === "diverging" || thesis.status === "questioned") {
    return "watch";
  }
  return "none";
}

export interface DetectDriftInput {
  schedule: ScheduleDriftInput;
  kpi: KpiDriftInput;
  contradictionCount: number;
  thesisThreshold?: number;
}

/** Run all three detectors and roll up the severity. Pure. */
export function detectDrift(input: DetectDriftInput): DriftReport {
  const schedule = scheduleDrift(input.schedule);
  const kpi = kpiDrift(input.kpi);
  const thesis = thesisDrift(input.contradictionCount, input.thesisThreshold);
  return { schedule, kpi, thesis, severity: overallSeverity(schedule, kpi, thesis) };
}

/** Does this report warrant a replan? Pure. */
export function needsReplan(report: DriftReport): boolean {
  return report.severity !== "none";
}

// ─────────────────────────────────────────────────────────────────────────────
// REPLAN ENGINE
// ─────────────────────────────────────────────────────────────────────────────

export type ReplanRecommendation = "continue" | "adjust-pace" | "pivot" | "kill";

export interface ReplanProposal {
  recommendation: ReplanRecommendation;
  rationale: string;
  /** Concrete adjustments to make. */
  adjustments: string[];
}

const REPLAN_OPTIONS: readonly ReplanRecommendation[] = [
  "continue",
  "adjust-pace",
  "pivot",
  "kill",
];

const REPLAN_SCHEMA = {
  name: "replan_proposal",
  strict: false,
  schema: {
    type: "object",
    properties: {
      recommendation: {
        type: "string",
        enum: ["continue", "adjust-pace", "pivot", "kill"],
      },
      rationale: { type: "string" },
      adjustments: { type: "array", items: { type: "string" } },
    },
    required: ["recommendation", "rationale"],
  },
} as const;

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" && v.trim() ? v.trim() : fallback;
}

/** Normalise the raw replan payload. Exported for tests. */
export function normalizeReplan(raw: unknown): ReplanProposal {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const recRaw = asString(o.recommendation).toLowerCase();
  const recommendation = (REPLAN_OPTIONS as readonly string[]).includes(recRaw)
    ? (recRaw as ReplanRecommendation)
    : "adjust-pace";
  const adjustments: string[] = [];
  if (Array.isArray(o.adjustments)) {
    for (const a of o.adjustments) {
      const s = asString(a);
      if (s) adjustments.push(s);
      if (adjustments.length >= 8) break;
    }
  }
  return {
    recommendation,
    rationale: asString(o.rationale, "No rationale was produced."),
    adjustments,
  };
}

function renderReport(report: DriftReport): string {
  return (
    `Schedule: ${report.schedule.status} (${report.schedule.driftPct} pts behind plan)\n` +
    `KPI: ${report.kpi.status} (${report.kpi.divergencePct}% divergence, ` +
    `${report.kpi.favorable ? "favourable" : "adverse"})\n` +
    `Thesis: ${report.thesis.status} (${report.thesis.contradictionCount} contradictions)\n` +
    `Overall: ${report.severity}`
  );
}

/**
 * Given a drift report, propose a replan: Continue / Adjust pace / Pivot /
 * Kill, with a rationale and concrete adjustments. Best-effort.
 */
export async function proposeReplan(
  initiative: string,
  report: DriftReport,
  context: string,
  ctx: RouterContext,
): Promise<ReplanProposal> {
  try {
    const result = await router.structured<Record<string, unknown>>({
      messages: [
        {
          role: "system",
          content:
            "You are a replan engine. Given an initiative's drift report, " +
            "recommend exactly one of: continue, adjust-pace, pivot, kill. " +
            "Be decisive — match the recommendation to the severity. Give a " +
            "short rationale and the concrete adjustments to make. Killing a " +
            "failing initiative early is a good outcome, not a failure.",
        },
        {
          role: "user",
          content:
            `INITIATIVE:\n${initiative}\n\n` +
            (context ? `Context:\n${context}\n\n` : "") +
            `DRIFT REPORT:\n${renderReport(report)}`,
        },
      ],
      schema: REPLAN_SCHEMA as unknown as {
        name: string;
        strict?: boolean;
        schema: Record<string, unknown>;
      },
      ctx,
    });
    return normalizeReplan(result.data);
  } catch {
    return {
      recommendation: "adjust-pace",
      rationale: "The replan engine could not complete — review the drift report manually.",
      adjustments: [],
    };
  }
}
