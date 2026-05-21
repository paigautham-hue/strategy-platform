/**
 * Unified Extraction Decision — IMPLEMENTATION_PLAN.md Workstream 1.4
 * Critical Pattern C23 · MEMORY_AND_LEARNING_REVIEW.md technique T2
 *
 * When a new claim arrives during ingest, exactly ONE decision is made about
 * it, seeing the K nearest existing memories at once:
 *
 *   ADD           — genuinely new ⇒ insert a new memory item
 *   NOOP          — duplicate of an existing item ⇒ reinforce, do not insert
 *   UPDATE        — refines an existing item ⇒ supersede it (same fact, better)
 *   SUPERSEDE     — replaces an existing item whose truth has moved on
 *   CONTRADICTION — conflicts with an existing item ⇒ open a contradiction edge
 *
 * Splitting extract / dedup / contradict into separate passes lets them
 * disagree (C23). This module makes the call once.
 *
 * Deterministic shortcuts run first (exact match, numeric classification) so
 * the LLM is only invoked for genuinely semantic cases — cheaper and more
 * reliable. The LLM call goes through the router (C3); its output is strictly
 * validated before use.
 */

import * as router from "../ai/router";
import type { RouterContext } from "../ai/router";
import { classifyNumericPair, type NumericClaim } from "./numeric-claim";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export const EXTRACTION_ACTIONS = [
  "add",
  "noop",
  "update",
  "supersede",
  "contradiction",
] as const;
export type ExtractionAction = (typeof EXTRACTION_ACTIONS)[number];

/** A claim freshly extracted from a document, awaiting its decision. */
export interface IncomingClaim {
  /** Verbatim text of the claim. */
  rawContent: string;
  /** S-P-O-qualifier canonical form (C20) — what gets embedded and compared. */
  canonicalForm: string;
  /** Structured numeric form, when the claim is quantitative. */
  numericClaim?: NumericClaim | null;
}

/** An existing memory item retrieved as a near-neighbour of the incoming claim. */
export interface ExistingCandidate {
  memoryItemId: number;
  canonicalForm: string;
  rawContent: string;
  numericClaim?: NumericClaim | null;
}

/** How the decision was reached — recorded for audit and debugging. */
export type DecisionMethod = "no-candidates" | "exact-match" | "numeric" | "llm";

export interface ExtractionDecision {
  action: ExtractionAction;
  /** The existing item acted upon. `null` only for ADD. */
  targetMemoryItemId: number | null;
  /** Short human-readable justification. */
  reason: string;
  /** Which path produced the decision. */
  method: DecisionMethod;
  /** Confidence in the decision itself, 0–1. */
  confidence: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// DETERMINISTIC RULES  (run before the LLM)
// ─────────────────────────────────────────────────────────────────────────────

/** Normalise canonical text for exact-match comparison. */
function normalizeForMatch(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Attempt a decision using only deterministic rules — no LLM.
 *
 *   - no candidates                       → ADD
 *   - exact canonical-form match          → NOOP (duplicate)
 *   - numeric "duplicate" vs a candidate  → NOOP
 *   - numeric "contradiction"             → CONTRADICTION
 *
 * Returns `null` when no rule fires and the LLM must decide.
 */
export function decideByDeterministicRules(
  incoming: IncomingClaim,
  candidates: ReadonlyArray<ExistingCandidate>,
): ExtractionDecision | null {
  if (candidates.length === 0) {
    return {
      action: "add",
      targetMemoryItemId: null,
      reason: "No existing memory near this claim.",
      method: "no-candidates",
      confidence: 1,
    };
  }

  // Exact canonical-form duplicate.
  const incomingKey = normalizeForMatch(incoming.canonicalForm);
  for (const c of candidates) {
    if (normalizeForMatch(c.canonicalForm) === incomingKey) {
      return {
        action: "noop",
        targetMemoryItemId: c.memoryItemId,
        reason: "Canonical form is identical to an existing memory item.",
        method: "exact-match",
        confidence: 1,
      };
    }
  }

  // Numeric claims: deterministic equality / contradiction.
  if (incoming.numericClaim) {
    for (const c of candidates) {
      if (!c.numericClaim) continue;
      const rel = classifyNumericPair(incoming.numericClaim, c.numericClaim);
      if (rel === "duplicate") {
        return {
          action: "noop",
          targetMemoryItemId: c.memoryItemId,
          reason: "Numeric claim is equivalent to an existing memory item.",
          method: "numeric",
          confidence: 1,
        };
      }
      if (rel === "contradiction") {
        return {
          action: "contradiction",
          targetMemoryItemId: c.memoryItemId,
          reason:
            "Numeric claim has the same unit and basis as an existing item but a different value.",
          method: "numeric",
          confidence: 1,
        };
      }
    }
  }

  // No deterministic rule fired — escalate to the LLM.
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// LLM DECISION
// ─────────────────────────────────────────────────────────────────────────────

/** Shape the LLM must return (validated before use). */
interface LlmDecisionRaw {
  action: string;
  /** Index into the candidates array, or -1 for ADD. */
  candidate_index: number;
  reason: string;
}

const LLM_DECISION_SCHEMA = {
  name: "extraction_decision",
  strict: true,
  schema: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: [...EXTRACTION_ACTIONS],
        description:
          "add = new fact; noop = duplicate; update = same fact stated better; " +
          "supersede = the world moved on; contradiction = conflicts with an existing item",
      },
      candidate_index: {
        type: "integer",
        description:
          "0-based index of the existing candidate this decision refers to, or -1 for action 'add'.",
      },
      reason: {
        type: "string",
        description: "One sentence explaining the decision.",
      },
    },
    required: ["action", "candidate_index", "reason"],
    additionalProperties: false,
  },
} as const;

function buildLlmPrompt(
  incoming: IncomingClaim,
  candidates: ReadonlyArray<ExistingCandidate>,
): string {
  const list = candidates
    .map((c, i) => `[${i}] ${c.canonicalForm}`)
    .join("\n");
  return (
    "You are deciding how a newly extracted claim relates to existing memory.\n\n" +
    `NEW CLAIM:\n${incoming.canonicalForm}\n\n` +
    `EXISTING NEAR-NEIGHBOUR ITEMS:\n${list}\n\n` +
    "Choose exactly one action:\n" +
    "- add: the new claim is genuinely new information\n" +
    "- noop: the new claim duplicates an existing item (no new information)\n" +
    "- update: the new claim states the SAME fact as an existing item, but more precisely or completely\n" +
    "- supersede: the new claim replaces an existing item because the underlying truth has changed over time\n" +
    "- contradiction: the new claim directly conflicts with an existing item at the same scope and time\n\n" +
    "For add, set candidate_index to -1. For every other action, set candidate_index " +
    "to the [index] of the single existing item the action refers to."
  );
}

/**
 * Validate and normalise the LLM's raw output into an `ExtractionDecision`.
 * Exported for unit testing — this is where most LLM-output bugs would hide.
 */
export function validateLlmDecision(
  raw: unknown,
  candidates: ReadonlyArray<ExistingCandidate>,
): ExtractionDecision {
  const r = raw as Partial<LlmDecisionRaw> | null | undefined;
  if (!r || typeof r !== "object") {
    throw new Error("extraction-decision: LLM returned a non-object decision.");
  }

  const action = r.action;
  if (typeof action !== "string" || !(EXTRACTION_ACTIONS as readonly string[]).includes(action)) {
    throw new Error(`extraction-decision: invalid action '${String(action)}'.`);
  }
  const reason = typeof r.reason === "string" && r.reason.trim() ? r.reason.trim() : "(no reason given)";
  const idx = r.candidate_index;

  if (action === "add") {
    // ADD must not reference a candidate.
    return {
      action: "add",
      targetMemoryItemId: null,
      reason,
      method: "llm",
      confidence: 0.8,
    };
  }

  // Every non-ADD action must point at a real candidate.
  if (typeof idx !== "number" || !Number.isInteger(idx) || idx < 0 || idx >= candidates.length) {
    throw new Error(
      `extraction-decision: action '${action}' requires a valid candidate_index ` +
        `in [0, ${candidates.length - 1}], got ${String(idx)}.`,
    );
  }

  return {
    action: action as ExtractionAction,
    targetMemoryItemId: candidates[idx].memoryItemId,
    reason,
    method: "llm",
    confidence: 0.8,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ORCHESTRATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Decide what to do with an incoming claim, given its nearest existing
 * memories. Deterministic rules first; the LLM only for semantic cases.
 *
 * @throws if the LLM output cannot be validated (caller should treat a thrown
 *         decision as "needs human review", never silently ADD).
 */
export async function decideExtraction(
  incoming: IncomingClaim,
  candidates: ReadonlyArray<ExistingCandidate>,
  ctx: RouterContext,
): Promise<ExtractionDecision> {
  const deterministic = decideByDeterministicRules(incoming, candidates);
  if (deterministic) return deterministic;

  const result = await router.structured<LlmDecisionRaw>({
    messages: [{ role: "user", content: buildLlmPrompt(incoming, candidates) }],
    schema: LLM_DECISION_SCHEMA as unknown as {
      name: string;
      strict?: boolean;
      schema: Record<string, unknown>;
    },
    ctx,
  });

  return validateLlmDecision(result.data, candidates);
}
