/**
 * Causal-Lite Attribution — IMPLEMENTATION_PLAN.md Phase 6, Workstream 6.4 / 6.6
 *
 * When an initiative completes, the platform asks the hard question: did the
 * initiative cause the outcome, or would it have happened anyway? The
 * attribution agent names the variables the team actually changed, sketches a
 * plausible counterfactual, assigns credit between internal and external
 * factors, and — crucially — names the confounders any causal claim must be
 * conditioned on (L1/L3, "every causal claim names plausible confounders").
 *
 * It also auto-drafts a post-mortem framed as HYPOTHESES, not verdicts (the
 * outputs need operator confirmation), and extracts one high-signal lesson
 * for procedural memory. Failure traces are first-class — a "what didn't"
 * with no entries is itself suspicious (anti-pattern AP6 / L4).
 */

import * as router from "../ai/router";
import type { RouterContext } from "../ai/router";
import { hybridSearchMemory } from "../services/memory-search";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type Contribution = "high" | "medium" | "low";

export interface CreditFactor {
  factor: string;
  contribution: Contribution;
  /** Was this the initiative's own doing (internal) or an external force? */
  isInternal: boolean;
}

export interface AttributionResult {
  initiative: string;
  /** What worked — framed as hypotheses, not verdicts. */
  whatWorked: string[];
  /** What did not work — failure traces are first-class (L4 / AP6). */
  whatDidnt: string[];
  /** The variables the team actually changed. */
  variablesChanged: string[];
  /** A plausible account of what would have happened anyway. */
  counterfactual: string;
  /** Credit split between internal and external factors. */
  creditAssignment: CreditFactor[];
  /** Confounders any causal claim here must be conditioned on (L1/L3). */
  confounders: string[];
  /** The one high-signal lesson worth landing in procedural memory. */
  lesson: string;
  /** Derived: did the agent surface at least one failure trace? */
  hasFailureTrace: boolean;
}

const MAX_LIST = 10;
const CONTRIBUTIONS: readonly Contribution[] = ["high", "medium", "low"];

// ─────────────────────────────────────────────────────────────────────────────
// SCHEMA
// ─────────────────────────────────────────────────────────────────────────────

const ATTRIBUTION_SCHEMA = {
  name: "causal_attribution",
  strict: false,
  schema: {
    type: "object",
    properties: {
      whatWorked: { type: "array", items: { type: "string" } },
      whatDidnt: { type: "array", items: { type: "string" } },
      variablesChanged: { type: "array", items: { type: "string" } },
      counterfactual: {
        type: "string",
        description: "What would plausibly have happened without the initiative.",
      },
      creditAssignment: {
        type: "array",
        items: {
          type: "object",
          properties: {
            factor: { type: "string" },
            contribution: { type: "string", enum: ["high", "medium", "low"] },
            isInternal: { type: "boolean", description: "Initiative's own doing vs. an external force." },
          },
          required: ["factor", "contribution", "isInternal"],
        },
      },
      confounders: {
        type: "array",
        items: { type: "string" },
        description: "Confounders any causal claim must be conditioned on.",
      },
      lesson: { type: "string", description: "The one high-signal lesson." },
    },
    required: ["counterfactual", "lesson"],
  },
} as const;

const SYSTEM_INSTRUCTION =
  "You attribute the outcome of a completed initiative. Name the variables the " +
  "team actually changed. Sketch a plausible counterfactual — what would have " +
  "happened anyway. Assign credit between internal factors (the initiative's " +
  "own doing) and external ones (market, macro, luck). NAME the confounders " +
  "any causal claim must be conditioned on — never assert causation without " +
  "them. Draft what worked and what did NOT, framed as hypotheses for the " +
  "operator to confirm. A post-mortem with no failure traces is a failure of " +
  "the post-mortem. Close with one high-signal lesson.";

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

function asCreditFactors(v: unknown): CreditFactor[] {
  if (!Array.isArray(v)) return [];
  const out: CreditFactor[] = [];
  for (const item of v) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const factor = asString(o.factor);
    if (!factor) continue;
    const c = asString(o.contribution).toLowerCase();
    const contribution = (CONTRIBUTIONS as readonly string[]).includes(c)
      ? (c as Contribution)
      : "medium";
    out.push({ factor, contribution, isInternal: o.isInternal === true });
    if (out.length >= MAX_LIST) break;
  }
  return out;
}

/** Normalise raw LLM output into an AttributionResult. Exported for tests. */
export function normalizeAttribution(raw: unknown, initiative: string): AttributionResult {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const whatDidnt = asStringList(o.whatDidnt);
  return {
    initiative,
    whatWorked: asStringList(o.whatWorked),
    whatDidnt,
    variablesChanged: asStringList(o.variablesChanged),
    counterfactual: asString(o.counterfactual, "No counterfactual was produced."),
    creditAssignment: asCreditFactors(o.creditAssignment),
    confounders: asStringList(o.confounders),
    lesson: asString(o.lesson, "No lesson was extracted."),
    hasFailureTrace: whatDidnt.length > 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ATTRIBUTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run a causal-lite attribution on a completed initiative, grounded in company
 * memory. Best-effort — returns an empty attribution on failure.
 */
export async function attributeInitiative(
  initiative: string,
  outcome: string,
  context: string,
  companyId: number,
  ctx: RouterContext,
): Promise<AttributionResult> {
  let memoryContext = "";
  try {
    const memories = await hybridSearchMemory({
      tenantId: ctx.tenantId,
      companyId,
      query: `${initiative} ${outcome}`.trim(),
      limit: 12,
      ctx: { ...ctx, companyId },
    });
    memoryContext = memories.map((m, i) => `${i + 1}. ${m.canonicalForm}`).join("\n");
  } catch {
    memoryContext = "";
  }

  const user =
    `COMPLETED INITIATIVE:\n${initiative}\n\n` +
    `OUTCOME:\n${outcome}\n\n` +
    (context ? `Context:\n${context}\n\n` : "") +
    (memoryContext ? `What the platform knows about the company:\n${memoryContext}` : "No company memory is available.");

  try {
    const result = await router.structured<Record<string, unknown>>({
      messages: [
        { role: "system", content: SYSTEM_INSTRUCTION },
        { role: "user", content: user },
      ],
      schema: ATTRIBUTION_SCHEMA as unknown as {
        name: string;
        strict?: boolean;
        schema: Record<string, unknown>;
      },
      ctx,
    });
    return normalizeAttribution(result.data, initiative);
  } catch {
    return {
      initiative,
      whatWorked: [],
      whatDidnt: [],
      variablesChanged: [],
      counterfactual: "The attribution could not complete.",
      creditAssignment: [],
      confounders: [],
      lesson: "No lesson was extracted.",
      hasFailureTrace: false,
    };
  }
}
