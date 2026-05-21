/**
 * Diagnosis Agent — IMPLEMENTATION_PLAN.md Phase 2, Workstream 2.2
 * Principle P4 — diagnosis precedes frameworks
 *
 * The entry point of the reasoning mesh. Before any framework is applied, the
 * Diagnosis agent challenges the framing of the user's question: is this the
 * RIGHT question? What kind of strategic question is it? What is genuinely
 * unknown? Which frameworks would actually help?
 *
 * This is deliberately a separate, first step — strategy is diagnosis, not
 * framework application. The Chief Strategist (2.1) dispatches research based
 * on this output; framework selection (Phase 3) is driven by `questionType`
 * and `suggestedFrameworks`, never by a user-facing framework menu (P4).
 *
 * One structured LLM call (C3) with defensive parsing.
 */

import * as router from "../ai/router";
import type { RouterContext } from "../ai/router";

// ─────────────────────────────────────────────────────────────────────────────
// QUESTION TAXONOMY
// ─────────────────────────────────────────────────────────────────────────────

export const QUESTION_TYPES = [
  "adjacency", // expand into an adjacent product / segment / channel
  "white_space", // find unmet demand / uncontested space
  "geographic", // enter a new geography
  "m_and_a", // acquire / merge / divest
  "pricing", // pricing & packaging
  "capability", // build / buy / partner a capability
  "competitive_response", // react to a competitor move
  "portfolio", // allocate across a portfolio of bets
  "scenario", // long-range / scenario planning
  "custom", // none of the above cleanly
] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export interface Diagnosis {
  /** The question, re-stated as the real strategic question to answer. */
  reframedQuestion: string;
  /** The kind of strategic question this is. */
  questionType: QuestionType;
  /** What is genuinely unknown — the gaps research must close. */
  keyUnknowns: string[];
  /** Frameworks the reasoning mesh should apply (names, not a user menu). */
  suggestedFrameworks: string[];
  /** Why the question was reframed this way / why this type. */
  rationale: string;
  /** Confidence that the reframing captures the real question. */
  confidence: "high" | "medium" | "low";
}

const CONFIDENCE_VALUES: readonly Diagnosis["confidence"][] = ["high", "medium", "low"];
const MAX_LIST_ITEMS = 12;

// ─────────────────────────────────────────────────────────────────────────────
// LLM SCHEMA
// ─────────────────────────────────────────────────────────────────────────────

const DIAGNOSIS_SCHEMA = {
  name: "strategy_diagnosis",
  strict: false,
  schema: {
    type: "object",
    properties: {
      reframedQuestion: {
        type: "string",
        description: "The real strategic question, sharpened — challenge a vague or wrong framing.",
      },
      questionType: { type: "string", enum: [...QUESTION_TYPES] },
      keyUnknowns: {
        type: "array",
        items: { type: "string" },
        description: "The genuine unknowns — what research must resolve to answer the question.",
      },
      suggestedFrameworks: {
        type: "array",
        items: { type: "string" },
        description:
          "Strategic frameworks that would genuinely help (e.g. Porter Five Forces, JTBD, " +
          "Ansoff, Wardley, Three Horizons, BCG, Blue Ocean, Disruption).",
      },
      rationale: {
        type: "string",
        description: "Why the question was reframed this way and classified this type.",
      },
      confidence: { type: "string", enum: ["high", "medium", "low"] },
    },
    required: ["reframedQuestion", "questionType", "confidence"],
  },
} as const;

const SYSTEM_INSTRUCTION =
  "You are a senior strategy consultant. Before any framework is applied, you " +
  "DIAGNOSE the question. Real strategy work is diagnosis, not framework " +
  "application. Challenge the user's framing — is this the right question, or " +
  "a symptom of a deeper one? Re-state the real strategic question crisply. " +
  "Classify its type. Name the genuine unknowns that research must close. " +
  "Suggest only the frameworks that would actually help. Be willing to say the " +
  "question as asked is the wrong question.";

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
    if (out.length >= MAX_LIST_ITEMS) break;
  }
  return out;
}

/**
 * Normalise raw LLM output into a Diagnosis. Exported for unit testing.
 * Falls back to the original question so a diagnosis is always usable.
 */
export function normalizeDiagnosis(raw: unknown, originalQuestion: string): Diagnosis {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;

  const typeStr = asString(o.questionType);
  const questionType: QuestionType = (QUESTION_TYPES as readonly string[]).includes(typeStr)
    ? (typeStr as QuestionType)
    : "custom";

  const confStr = asString(o.confidence);
  const confidence: Diagnosis["confidence"] = (CONFIDENCE_VALUES as readonly string[]).includes(
    confStr,
  )
    ? (confStr as Diagnosis["confidence"])
    : "low";

  return {
    reframedQuestion: asString(o.reframedQuestion, originalQuestion.trim()),
    questionType,
    keyUnknowns: asStringList(o.keyUnknowns),
    suggestedFrameworks: asStringList(o.suggestedFrameworks),
    rationale: asString(o.rationale),
    confidence,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// DIAGNOSIS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Diagnose a raw strategic question. Best-effort: on LLM failure, returns a
 * low-confidence diagnosis built from the original question so the pipeline
 * can still proceed.
 */
export async function diagnoseQuestion(
  rawQuestion: string,
  ctx: RouterContext,
  companyContext?: string,
): Promise<Diagnosis> {
  const question = rawQuestion.trim();
  if (!question) {
    return {
      reframedQuestion: "",
      questionType: "custom",
      keyUnknowns: [],
      suggestedFrameworks: [],
      rationale: "No question was provided.",
      confidence: "low",
    };
  }

  const userContent = companyContext
    ? `Company context:\n${companyContext}\n\nStrategic question:\n${question}`
    : `Strategic question:\n${question}`;

  try {
    const result = await router.structured<Record<string, unknown>>({
      messages: [
        { role: "system", content: SYSTEM_INSTRUCTION },
        { role: "user", content: userContent },
      ],
      schema: DIAGNOSIS_SCHEMA as unknown as {
        name: string;
        strict?: boolean;
        schema: Record<string, unknown>;
      },
      ctx,
    });
    return normalizeDiagnosis(result.data, question);
  } catch {
    return normalizeDiagnosis({}, question);
  }
}
