/**
 * Option Generator + MCDA Evaluator — IMPLEMENTATION_PLAN.md Phase 3, 3.2
 *
 * Generates a set of strategic options for a diagnosed question and scores
 * each with multi-criteria decision analysis. The LLM generates options and
 * raw 0-10 scores on eight criteria; the weighting, ranking, and sensitivity
 * analysis are deterministic, pure functions — testable and auditable.
 *
 * All criteria are framed "higher is better" (execution risk → execution
 * safety) so the weighted score is a simple linear combination.
 */

import * as router from "../ai/router";
import type { RouterContext } from "../ai/router";
import { hybridSearchMemory } from "../services/memory-search";

// ─────────────────────────────────────────────────────────────────────────────
// MCDA CRITERIA
// ─────────────────────────────────────────────────────────────────────────────

export interface McdaCriterion {
  id: string;
  label: string;
  /** Default weight. Weights across all criteria sum to 1. */
  weight: number;
}

export const MCDA_CRITERIA: readonly McdaCriterion[] = [
  { id: "strategic_fit", label: "Strategic fit", weight: 0.18 },
  { id: "market_attractiveness", label: "Market attractiveness", weight: 0.15 },
  { id: "capability_fit", label: "Capability fit", weight: 0.15 },
  { id: "financial_return", label: "Financial return", weight: 0.18 },
  { id: "execution_safety", label: "Execution safety (low risk)", weight: 0.12 },
  { id: "time_to_value", label: "Speed to value", weight: 0.08 },
  { id: "reversibility", label: "Reversibility", weight: 0.06 },
  { id: "synergy_value", label: "Portfolio synergy", weight: 0.08 },
] as const;

export type CriterionScores = Record<string, number>;

// ─────────────────────────────────────────────────────────────────────────────
// PURE MCDA MATH
// ─────────────────────────────────────────────────────────────────────────────

/** Clamp a raw score into the 0–10 band. */
export function clampScore(n: unknown): number {
  if (typeof n !== "number" || !Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 10) return 10;
  return n;
}

/**
 * Weighted MCDA score (0–10) for a set of criterion scores. Missing criteria
 * count as 0. Pure.
 */
export function computeWeightedScore(
  scores: CriterionScores,
  weights: ReadonlyArray<McdaCriterion> = MCDA_CRITERIA,
): number {
  let total = 0;
  let weightSum = 0;
  for (const c of weights) {
    total += clampScore(scores[c.id]) * c.weight;
    weightSum += c.weight;
  }
  // Normalise by the weight sum so partial criterion sets still yield 0–10.
  return weightSum > 0 ? total / weightSum : 0;
}

/**
 * Sensitivity check: re-score with each criterion's weight perturbed ±20% and
 * see whether the top-ranked option stays on top. Pure.
 *
 * @returns `true` if the winner is robust to the perturbations.
 */
export function isRankingRobust(
  evaluations: ReadonlyArray<{ optionId: string; scores: CriterionScores }>,
): boolean {
  if (evaluations.length < 2) return true;

  const baseWinner = [...evaluations]
    .map((e) => ({ id: e.optionId, score: computeWeightedScore(e.scores) }))
    .sort((a, b) => b.score - a.score)[0].id;

  for (const perturbed of [0.8, 1.2]) {
    for (let i = 0; i < MCDA_CRITERIA.length; i++) {
      const weights = MCDA_CRITERIA.map((c, j) =>
        j === i ? { ...c, weight: c.weight * perturbed } : c,
      );
      const winner = [...evaluations]
        .map((e) => ({ id: e.optionId, score: computeWeightedScore(e.scores, weights) }))
        .sort((a, b) => b.score - a.score)[0].id;
      if (winner !== baseWinner) return false;
    }
  }
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface OptionEvaluation {
  optionId: string;
  title: string;
  description: string;
  rationale: string;
  scores: CriterionScores;
  /** Weighted MCDA score, 0–10. */
  weightedScore: number;
}

export interface OptionAnalysis {
  question: string;
  options: OptionEvaluation[];
  /** Is the top option robust to ±20% weight perturbation? */
  rankingRobust: boolean;
}

const MAX_OPTIONS = 12;

// ─────────────────────────────────────────────────────────────────────────────
// LLM GENERATION
// ─────────────────────────────────────────────────────────────────────────────

const OPTIONS_SCHEMA = {
  name: "strategic_options",
  strict: false,
  schema: {
    type: "object",
    properties: {
      options: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            rationale: { type: "string" },
            scores: {
              type: "object",
              description: "0-10 score for each criterion (higher is better for all).",
              properties: Object.fromEntries(
                MCDA_CRITERIA.map((c) => [c.id, { type: "number" }]),
              ),
            },
          },
          required: ["title", "description", "scores"],
        },
      },
    },
    required: ["options"],
  },
} as const;

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" && v.trim() ? v.trim() : fallback;
}

/** Normalise raw LLM output into evaluated, weighted, ranked options. Pure. */
export function normalizeOptionAnalysis(raw: unknown, question: string): OptionAnalysis {
  const list =
    raw && typeof raw === "object" && Array.isArray((raw as { options?: unknown }).options)
      ? (raw as { options: unknown[] }).options
      : [];

  const options: OptionEvaluation[] = [];
  list.forEach((item, index) => {
    if (!item || typeof item !== "object" || options.length >= MAX_OPTIONS) return;
    const o = item as Record<string, unknown>;
    const title = asString(o.title);
    if (!title) return;

    const rawScores = (o.scores && typeof o.scores === "object" ? o.scores : {}) as CriterionScores;
    const scores: CriterionScores = {};
    for (const c of MCDA_CRITERIA) scores[c.id] = clampScore(rawScores[c.id]);

    options.push({
      optionId: `opt-${index + 1}`,
      title,
      description: asString(o.description),
      rationale: asString(o.rationale),
      scores,
      weightedScore: computeWeightedScore(scores),
    });
  });

  options.sort((a, b) => b.weightedScore - a.weightedScore);
  return {
    question,
    options,
    rankingRobust: isRankingRobust(options),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ORCHESTRATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate and evaluate strategic options for a question, grounded in the
 * company's memory. Best-effort — returns an empty analysis on failure.
 */
export async function runOptionAnalysis(
  question: string,
  companyId: number,
  ctx: RouterContext,
): Promise<OptionAnalysis> {
  let memoryContext = "";
  try {
    const memories = await hybridSearchMemory({
      tenantId: ctx.tenantId,
      companyId,
      query: question,
      limit: 15,
      ctx: { ...ctx, companyId },
    });
    memoryContext = memories.map((m, i) => `${i + 1}. ${m.canonicalForm}`).join("\n");
  } catch {
    memoryContext = "";
  }

  const criteriaList = MCDA_CRITERIA.map((c) => `- ${c.id}: ${c.label}`).join("\n");
  const system =
    "You are a strategy analyst. Generate 4-8 genuinely distinct strategic options " +
    "for the question — not variations of one idea. For each option, score it 0-10 " +
    "on every criterion (higher is always better, including execution_safety where " +
    "10 means low risk). Be discriminating — do not score everything 7-8.\n\n" +
    `Criteria:\n${criteriaList}`;
  const user =
    `Question:\n${question}\n\n` +
    (memoryContext
      ? `What the platform knows about this company:\n${memoryContext}`
      : "No company memory is available — note this limits scoring confidence.");

  try {
    const result = await router.structured<Record<string, unknown>>({
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      schema: OPTIONS_SCHEMA as unknown as {
        name: string;
        strict?: boolean;
        schema: Record<string, unknown>;
      },
      ctx,
    });
    return normalizeOptionAnalysis(result.data, question);
  } catch {
    return { question, options: [], rankingRobust: true };
  }
}
