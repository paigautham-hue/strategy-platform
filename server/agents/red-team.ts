/**
 * Red-Team Critic — IMPLEMENTATION_PLAN.md Phase 3, Workstream 3.3
 *
 * Every strategy is stress-tested adversarially before it is trusted. The
 * red team attacks a proposed strategy from five hostile vantage points and
 * grades each critique by severity. A strategy with a fatal flaw has NOT
 * survived review — that verdict is computed deterministically.
 *
 * The memory-and-learning review (AP6) warns against only-success thinking;
 * the red team is the structural counterweight: it is rewarded for finding
 * what breaks, not for agreeing.
 */

import * as router from "../ai/router";
import type { RouterContext } from "../ai/router";
import { hybridSearchMemory } from "../services/memory-search";

// ─────────────────────────────────────────────────────────────────────────────
// PERSONAS
// ─────────────────────────────────────────────────────────────────────────────

export interface RedTeamPersona {
  id: string;
  label: string;
  /** The adversarial stance this persona takes. */
  stance: string;
}

export const RED_TEAM_PERSONAS: readonly RedTeamPersona[] = [
  {
    id: "contrarian",
    label: "The Contrarian",
    stance: "argues the opposite is true — attacks the core assumption directly",
  },
  {
    id: "regulator",
    label: "The Regulator",
    stance: "looks for compliance, legal, and policy exposure the plan ignores",
  },
  {
    id: "incumbent",
    label: "The Incumbent Competitor",
    stance: "is the competitor who will retaliate — how do they kill this?",
  },
  {
    id: "skeptical_investor",
    label: "The Skeptical Investor",
    stance: "doubts the financial case and the return on capital and attention",
  },
  {
    id: "execution_skeptic",
    label: "The Execution Skeptic",
    stance: "has seen plans fail in delivery — attacks feasibility, talent, and timeline",
  },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type CritiqueSeverity = "fatal" | "major" | "minor";

export interface RedTeamCritique {
  persona: string;
  personaLabel: string;
  critique: string;
  severity: CritiqueSeverity;
}

export interface RedTeamReview {
  strategy: string;
  critiques: RedTeamCritique[];
  /** Critiques graded `fatal` — the strategy must address these to proceed. */
  fatalFlaws: string[];
  verdict: string;
  /** True only when no fatal flaw was found. Derived, not LLM-set. */
  survivedReview: boolean;
}

const SEVERITIES: readonly CritiqueSeverity[] = ["fatal", "major", "minor"];

// ─────────────────────────────────────────────────────────────────────────────
// PURE LOGIC
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A strategy survives red-team review only when no critique is fatal. Pure —
 * the verdict is never left to the model to self-assess. Exported for tests.
 */
export function survivedReview(critiques: ReadonlyArray<RedTeamCritique>): boolean {
  return !critiques.some((c) => c.severity === "fatal");
}

// ─────────────────────────────────────────────────────────────────────────────
// LLM SCHEMA + PARSING
// ─────────────────────────────────────────────────────────────────────────────

const REVIEW_SCHEMA = {
  name: "red_team_review",
  strict: false,
  schema: {
    type: "object",
    properties: {
      critiques: {
        type: "array",
        items: {
          type: "object",
          properties: {
            persona: { type: "string", enum: RED_TEAM_PERSONAS.map((p) => p.id) },
            critique: { type: "string" },
            severity: { type: "string", enum: ["fatal", "major", "minor"] },
          },
          required: ["persona", "critique", "severity"],
        },
      },
      verdict: { type: "string", description: "The red team's overall verdict on the strategy." },
    },
    required: ["critiques", "verdict"],
  },
} as const;

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" && v.trim() ? v.trim() : fallback;
}

/** Normalise raw LLM output into a RedTeamReview. Exported for tests. */
export function normalizeRedTeamReview(raw: unknown, strategy: string): RedTeamReview {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const rawCritiques = Array.isArray(o.critiques) ? o.critiques : [];

  const critiques: RedTeamCritique[] = [];
  for (const item of rawCritiques) {
    if (!item || typeof item !== "object") continue;
    const c = item as Record<string, unknown>;
    const critique = asString(c.critique);
    if (!critique) continue;
    const personaId = asString(c.persona);
    const persona = RED_TEAM_PERSONAS.find((p) => p.id === personaId);
    const sevStr = asString(c.severity);
    const severity: CritiqueSeverity = (SEVERITIES as readonly string[]).includes(sevStr)
      ? (sevStr as CritiqueSeverity)
      : "major";
    critiques.push({
      persona: persona?.id ?? "contrarian",
      personaLabel: persona?.label ?? "The Contrarian",
      critique,
      severity,
    });
  }

  const fatalFlaws = critiques.filter((c) => c.severity === "fatal").map((c) => c.critique);

  return {
    strategy,
    critiques,
    fatalFlaws,
    verdict: asString(o.verdict, "No verdict produced."),
    survivedReview: survivedReview(critiques),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// RED-TEAM REVIEW
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run an adversarial red-team review of a strategy, grounded in company memory.
 * Best-effort — returns an empty (passing) review on failure rather than
 * blocking, but logs nothing as fatal it did not actually find.
 */
export async function redTeamStrategy(
  strategy: string,
  companyId: number,
  ctx: RouterContext,
): Promise<RedTeamReview> {
  let memoryContext = "";
  try {
    const memories = await hybridSearchMemory({
      tenantId: ctx.tenantId,
      companyId,
      query: strategy,
      limit: 12,
      ctx: { ...ctx, companyId },
    });
    memoryContext = memories.map((m, i) => `${i + 1}. ${m.canonicalForm}`).join("\n");
  } catch {
    memoryContext = "";
  }

  const personaList = RED_TEAM_PERSONAS.map((p) => `- ${p.id} (${p.label}): ${p.stance}`).join(
    "\n",
  );
  const system =
    "You are a strategy red team. Attack the proposed strategy hard from EACH of the " +
    "five vantage points below — one or more critiques per persona. Grade every " +
    "critique fatal / major / minor. A fatal critique is one that, unaddressed, " +
    "means the strategy should not proceed. Do not soften — your job is to find what " +
    `breaks.\n\nPersonas:\n${personaList}`;
  const user =
    `Proposed strategy:\n${strategy}\n\n` +
    (memoryContext ? `Company context:\n${memoryContext}` : "No company context available.");

  try {
    const result = await router.structured<Record<string, unknown>>({
      task: "planner",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      schema: REVIEW_SCHEMA as unknown as {
        name: string;
        strict?: boolean;
        schema: Record<string, unknown>;
      },
      ctx,
    });
    return normalizeRedTeamReview(result.data, strategy);
  } catch {
    // Fail CLOSED: a review that could not run must never read as a pass —
    // "survived" here would clear strategies the red team never saw.
    return {
      strategy,
      critiques: [],
      fatalFlaws: ["The red-team review could not be completed — do not treat this strategy as cleared. Re-run the review."],
      verdict: "Review failed to run. Not cleared.",
      survivedReview: false,
    };
  }
}
