/**
 * Strategy Decomposer — IMPLEMENTATION_PLAN.md Phase 5, Workstream 5.1
 *
 * The Strategy → Execution bridge. A strategy thesis is decomposed into a
 * small set of initiatives; each initiative carries OKRs (an objective plus
 * key results) and a concrete task list. A deterministic challenger then
 * flags every objective that lacks a quantitative key result — vague OKRs
 * never pass silently (Phase 5 risk mitigation).
 *
 * Decomposition is stateless reasoning. Persisting initiatives / OKRs as
 * first-class records and syncing them to execution tools (Linear, Notion)
 * is Workstream 5.2 — connector-gated.
 */

import * as router from "../ai/router";
import type { RouterContext } from "../ai/router";
import { hybridSearchMemory } from "../services/memory-search";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type IndicatorKind = "leading" | "lagging";

export interface KeyResult {
  text: string;
  indicator: IndicatorKind;
  /** Derived: does the key result state a measurable target? */
  quantitative: boolean;
}

export interface Okr {
  objective: string;
  keyResults: KeyResult[];
}

export interface Initiative {
  title: string;
  rationale: string;
  expectedImpact: string;
  costEstimate: string;
  /** 0–1 — confidence the initiative delivers its expected impact. */
  confidence: number;
  dependencies: string[];
  okrs: Okr[];
  tasks: string[];
}

export interface Decomposition {
  thesis: string;
  initiatives: Initiative[];
  /** Objectives with no quantitative key result — the challenger's flags. */
  vagueObjectives: string[];
  /** Total OKR count across all initiatives. */
  okrCount: number;
}

const MAX_INITIATIVES = 6;
const MAX_OKRS_PER_INITIATIVE = 5;
const MAX_KRS_PER_OKR = 5;
const MAX_TASKS = 12;
const MAX_DEPENDENCIES = 8;

// ─────────────────────────────────────────────────────────────────────────────
// SCHEMA
// ─────────────────────────────────────────────────────────────────────────────

const DECOMPOSE_SCHEMA = {
  name: "strategy_decomposition",
  strict: false,
  schema: {
    type: "object",
    properties: {
      initiatives: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            rationale: { type: "string", description: "Why this initiative serves the thesis." },
            expectedImpact: { type: "string" },
            costEstimate: { type: "string", description: "Rough cost / effort estimate." },
            confidence: { type: "number", description: "0-1 confidence in the expected impact." },
            dependencies: { type: "array", items: { type: "string" } },
            okrs: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  objective: { type: "string" },
                  keyResults: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        text: { type: "string", description: "A measurable key result." },
                        indicator: { type: "string", enum: ["leading", "lagging"] },
                      },
                      required: ["text"],
                    },
                  },
                },
                required: ["objective", "keyResults"],
              },
            },
            tasks: { type: "array", items: { type: "string" } },
          },
          required: ["title", "rationale", "okrs"],
        },
      },
    },
    required: ["initiatives"],
  },
} as const;

const SYSTEM_INSTRUCTION =
  "You are a strategy decomposer. Turn a strategy thesis into 3-5 concrete " +
  "initiatives. Each initiative needs a rationale tying it to the thesis, an " +
  "expected impact, a rough cost estimate, a confidence (0-1), dependencies, " +
  "1-3 OKRs, and a short task list. EVERY objective MUST have at least one " +
  "QUANTITATIVE key result — a measurable target with a number, percentage, " +
  "or currency amount. Mark each key result leading or lagging. Vague, " +
  "unmeasurable OKRs are unacceptable. Be specific and realistic.";

// ─────────────────────────────────────────────────────────────────────────────
// DEFENSIVE PARSING + CHALLENGER
// ─────────────────────────────────────────────────────────────────────────────

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" && v.trim() ? v.trim() : fallback;
}

function asStringList(v: unknown, cap: number): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const item of v) {
    const s = asString(item);
    if (s) out.push(s);
    if (out.length >= cap) break;
  }
  return out;
}

function asConfidence(v: unknown): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return 0.5;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return Math.round(v * 100) / 100;
}

/**
 * Does a key result state a measurable target? The challenger's test — a KR
 * is quantitative if it contains a number, percentage, or currency amount.
 * Pure — exported for tests.
 */
export function isQuantitative(text: string): boolean {
  return /\d/.test(text) || /%|\$|€|£/.test(text);
}

function normalizeKeyResults(raw: unknown): KeyResult[] {
  if (!Array.isArray(raw)) return [];
  const out: KeyResult[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const text = asString(o.text);
    if (!text) continue;
    const indicator: IndicatorKind = asString(o.indicator).toLowerCase() === "leading" ? "leading" : "lagging";
    out.push({ text, indicator, quantitative: isQuantitative(text) });
    if (out.length >= MAX_KRS_PER_OKR) break;
  }
  return out;
}

function normalizeOkrs(raw: unknown): Okr[] {
  if (!Array.isArray(raw)) return [];
  const out: Okr[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const objective = asString(o.objective);
    if (!objective) continue;
    out.push({ objective, keyResults: normalizeKeyResults(o.keyResults) });
    if (out.length >= MAX_OKRS_PER_INITIATIVE) break;
  }
  return out;
}

function normalizeInitiatives(raw: unknown): Initiative[] {
  if (!Array.isArray(raw)) return [];
  const out: Initiative[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const title = asString(o.title);
    if (!title) continue;
    out.push({
      title,
      rationale: asString(o.rationale),
      expectedImpact: asString(o.expectedImpact),
      costEstimate: asString(o.costEstimate),
      confidence: asConfidence(o.confidence),
      dependencies: asStringList(o.dependencies, MAX_DEPENDENCIES),
      okrs: normalizeOkrs(o.okrs),
      tasks: asStringList(o.tasks, MAX_TASKS),
    });
    if (out.length >= MAX_INITIATIVES) break;
  }
  return out;
}

/**
 * The decomposer challenger: every objective that lacks a quantitative key
 * result is flagged. Pure — exported for tests.
 */
export function flagVagueObjectives(initiatives: Initiative[]): string[] {
  const flagged: string[] = [];
  for (const ini of initiatives) {
    for (const okr of ini.okrs) {
      if (!okr.keyResults.some((kr) => kr.quantitative)) {
        flagged.push(okr.objective);
      }
    }
  }
  return flagged;
}

/** Normalise raw LLM output into a Decomposition. Exported for tests. */
export function normalizeDecomposition(raw: unknown, thesis: string): Decomposition {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const initiatives = normalizeInitiatives(o.initiatives);
  const okrCount = initiatives.reduce((n, ini) => n + ini.okrs.length, 0);
  return {
    thesis,
    initiatives,
    vagueObjectives: flagVagueObjectives(initiatives),
    okrCount,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// DECOMPOSITION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Decompose a strategy thesis into initiatives → OKRs → tasks, grounded in
 * company memory. Best-effort — returns an empty decomposition on failure.
 */
export async function decomposeStrategy(
  thesis: string,
  companyId: number,
  ctx: RouterContext,
): Promise<Decomposition> {
  let memoryContext = "";
  try {
    const memories = await hybridSearchMemory({
      tenantId: ctx.tenantId,
      companyId,
      query: thesis,
      limit: 12,
      ctx: { ...ctx, companyId },
    });
    memoryContext = memories.map((m, i) => `${i + 1}. ${m.canonicalForm}`).join("\n");
  } catch {
    memoryContext = "";
  }

  const user =
    `STRATEGY THESIS:\n${thesis}\n\n` +
    (memoryContext ? `Company context:\n${memoryContext}` : "No company memory is available.");

  try {
    const result = await router.structured<Record<string, unknown>>({
      task: "planner",
      messages: [
        { role: "system", content: SYSTEM_INSTRUCTION },
        { role: "user", content: user },
      ],
      schema: DECOMPOSE_SCHEMA as unknown as {
        name: string;
        strict?: boolean;
        schema: Record<string, unknown>;
      },
      ctx,
    });
    return normalizeDecomposition(result.data, thesis);
  } catch {
    return { thesis, initiatives: [], vagueObjectives: [], okrCount: 0 };
  }
}
