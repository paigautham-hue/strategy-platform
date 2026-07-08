/**
 * Playbook Engine — IMPLEMENTATION_PLAN.md Phase 6, Workstream 6.3
 * Voyager-style outcome-gated skill promotion (T11, M1–M3)
 *
 * A playbook is a reusable strategic skill: trigger conditions, steps with
 * gates, and expected outcomes. Playbooks are drafted by the LLM from
 * clustered patterns, then PROMOTED through three layers — project → company
 * → portfolio — only after passing checks:
 *
 *   - outcome gate (T11/M3) — enough evidence projects, with a real hit rate.
 *   - diversity requirement (M1) — Portfolio promotion needs evidence that
 *     spans ≥ 2 industries OR ≥ 2 geos OR ≥ 2 stages, so a playbook cannot be
 *     promoted on portco-idiosyncratic luck.
 *   - stale retirement (M2) — a playbook below a hit-rate floor after enough
 *     time is auto-archived.
 *
 * The promotion gates are PURE functions. Persisting playbooks and running the
 * retirement cron depend on the calibration cron — infra-gated.
 */

import * as router from "../ai/router";
import type { RouterContext } from "../ai/router";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type PlaybookLayer = "project" | "company" | "portfolio";

export interface PlaybookStep {
  order: number;
  action: string;
  /** What must be true to clear this step before moving on. */
  gate: string;
}

export interface Playbook {
  title: string;
  /** When this playbook should be surfaced. */
  triggerConditions: string[];
  steps: PlaybookStep[];
  expectedOutcomes: string[];
  /** The lifecycle layer a freshly drafted playbook starts at. */
  layer: PlaybookLayer;
}

/** One project the playbook has been applied to — the promotion evidence. */
export interface EvidenceProject {
  industry: string;
  geo: string;
  stage: string;
  /** Did applying the playbook here succeed (outcome-confirmed)? */
  succeeded: boolean;
}

const MAX_STEPS = 12;
const MAX_LIST = 10;
const MIN_EVIDENCE_PROJECTS = 3;
const MIN_OUTCOME_HIT_RATE = 0.5;
const RETIRE_HIT_RATE_FLOOR = 0.3;
const RETIRE_AGE_MONTHS = 6;
const LAYER_ORDER: readonly PlaybookLayer[] = ["project", "company", "portfolio"];

// ─────────────────────────────────────────────────────────────────────────────
// SCHEMA
// ─────────────────────────────────────────────────────────────────────────────

const PLAYBOOK_SCHEMA = {
  name: "playbook_draft",
  strict: false,
  schema: {
    type: "object",
    properties: {
      title: { type: "string" },
      triggerConditions: {
        type: "array",
        items: { type: "string" },
        description: "When this playbook should be surfaced.",
      },
      steps: {
        type: "array",
        items: {
          type: "object",
          properties: {
            action: { type: "string" },
            gate: { type: "string", description: "What must be true to clear this step." },
          },
          required: ["action"],
        },
      },
      expectedOutcomes: { type: "array", items: { type: "string" } },
    },
    required: ["title", "steps"],
  },
} as const;

const SYSTEM_INSTRUCTION =
  "You draft a reusable strategic playbook from a recurring pattern. Give it a " +
  "specific title, the trigger conditions that should surface it, an ordered " +
  "list of steps — each with a gate (what must be true to move on) — and the " +
  "expected outcomes. Be concrete and transferable; a playbook that only fits " +
  "one company is not a playbook. Do not invent evidence.";

// ─────────────────────────────────────────────────────────────────────────────
// DEFENSIVE PARSING
// ─────────────────────────────────────────────────────────────────────────────

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" && v.trim() ? v.trim() : fallback;
}

function asStringList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const item of v) {
    const s = asString(item);
    if (s) out.push(s);
    if (out.length >= MAX_LIST) break;
  }
  return out;
}

function asSteps(v: unknown): PlaybookStep[] {
  if (!Array.isArray(v)) return [];
  const out: PlaybookStep[] = [];
  for (const item of v) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const action = asString(o.action);
    if (!action) continue;
    out.push({ order: out.length + 1, action, gate: asString(o.gate, "—") });
    if (out.length >= MAX_STEPS) break;
  }
  return out;
}

/** Normalise raw LLM output into a Playbook. A draft always starts at the
 * project layer. Exported for tests. */
export function normalizePlaybook(raw: unknown): Playbook {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    title: asString(o.title, "Untitled playbook"),
    triggerConditions: asStringList(o.triggerConditions),
    steps: asSteps(o.steps),
    expectedOutcomes: asStringList(o.expectedOutcomes),
    layer: "project",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PROMOTION GATES (pure)
// ─────────────────────────────────────────────────────────────────────────────

export interface DiversityScore {
  industries: number;
  geos: number;
  stages: number;
}

/** Count the distinct industries / geos / stages in the evidence. Pure. */
export function evidenceDiversity(projects: EvidenceProject[]): DiversityScore {
  const norm = (s: string) => s.trim().toLowerCase();
  return {
    industries: new Set(projects.map((p) => norm(p.industry)).filter(Boolean)).size,
    geos: new Set(projects.map((p) => norm(p.geo)).filter(Boolean)).size,
    stages: new Set(projects.map((p) => norm(p.stage)).filter(Boolean)).size,
  };
}

/** Diversity requirement (M1) — ≥ 2 industries OR ≥ 2 geos OR ≥ 2 stages. Pure. */
export function meetsDiversityRequirement(projects: EvidenceProject[]): boolean {
  const d = evidenceDiversity(projects);
  return d.industries >= 2 || d.geos >= 2 || d.stages >= 2;
}

/** Fraction of evidence projects where the playbook succeeded. Pure. */
export function outcomeHitRate(projects: EvidenceProject[]): number {
  if (projects.length === 0) return 0;
  const hits = projects.filter((p) => p.succeeded).length;
  return Math.round((hits / projects.length) * 10000) / 10000;
}

/** Outcome gate (T11/M3) — enough evidence projects, with a real hit rate. Pure. */
export function meetsOutcomeGate(projects: EvidenceProject[]): boolean {
  return (
    projects.length >= MIN_EVIDENCE_PROJECTS &&
    outcomeHitRate(projects) >= MIN_OUTCOME_HIT_RATE
  );
}

/** The next layer up, or null if already at the top. Pure. */
export function nextLayer(layer: PlaybookLayer): PlaybookLayer | null {
  const idx = LAYER_ORDER.indexOf(layer);
  if (idx < 0 || idx >= LAYER_ORDER.length - 1) return null;
  return LAYER_ORDER[idx + 1];
}

export interface PromotionVerdict {
  promotable: boolean;
  currentLayer: PlaybookLayer;
  targetLayer: PlaybookLayer | null;
  /** The reasons it can or cannot be promoted. */
  reasons: string[];
}

/**
 * Decide whether a playbook can be promoted to the next layer given its
 * evidence. project → company needs the outcome gate; company → portfolio
 * additionally needs the diversity requirement. Pure — exported for tests.
 */
export function checkPromotion(
  currentLayer: PlaybookLayer,
  projects: EvidenceProject[],
): PromotionVerdict {
  const target = nextLayer(currentLayer);
  const reasons: string[] = [];

  if (target === null) {
    return {
      promotable: false,
      currentLayer,
      targetLayer: null,
      reasons: ["Already at the portfolio layer — the top of the ladder."],
    };
  }

  const outcomeOk = meetsOutcomeGate(projects);
  if (outcomeOk) {
    reasons.push(
      `Outcome gate met — ${projects.length} evidence projects, ` +
        `${(outcomeHitRate(projects) * 100).toFixed(0)}% hit rate.`,
    );
  } else {
    reasons.push(
      `Outcome gate not met — needs ≥ ${MIN_EVIDENCE_PROJECTS} evidence projects ` +
        `and ≥ ${MIN_OUTCOME_HIT_RATE * 100}% hit rate.`,
    );
  }

  let diversityOk = true;
  if (target === "portfolio") {
    diversityOk = meetsDiversityRequirement(projects);
    reasons.push(
      diversityOk
        ? "Diversity requirement met — evidence spans multiple industries, geos, or stages."
        : "Diversity requirement not met — needs ≥ 2 industries, geos, or stages.",
    );
  }

  return {
    promotable: outcomeOk && diversityOk,
    currentLayer,
    targetLayer: target,
    reasons,
  };
}

/** Stale retirement (M2) — below the hit-rate floor after enough time. Pure. */
export function shouldRetire(hitRate: number, ageMonths: number): boolean {
  return hitRate < RETIRE_HIT_RATE_FLOOR && ageMonths >= RETIRE_AGE_MONTHS;
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTO-DRAFT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Draft a playbook from a recurring pattern description. Best-effort — returns
 * an empty playbook on failure.
 */
export async function draftPlaybook(
  pattern: string,
  evidenceSummary: string,
  ctx: RouterContext,
): Promise<Playbook> {
  try {
    const result = await router.structured<Record<string, unknown>>({
      task: "extraction",
      messages: [
        { role: "system", content: SYSTEM_INSTRUCTION },
        {
          role: "user",
          content:
            `RECURRING PATTERN:\n${pattern}\n\n` +
            (evidenceSummary ? `EVIDENCE SO FAR:\n${evidenceSummary}` : "No evidence summary provided."),
        },
      ],
      schema: PLAYBOOK_SCHEMA as unknown as {
        name: string;
        strict?: boolean;
        schema: Record<string, unknown>;
      },
      ctx,
    });
    return normalizePlaybook(result.data);
  } catch {
    return {
      title: "Draft failed",
      triggerConditions: [],
      steps: [],
      expectedOutcomes: [],
      layer: "project",
    };
  }
}
