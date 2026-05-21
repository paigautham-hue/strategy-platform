/**
 * Confidence Decay — IMPLEMENTATION_PLAN.md Workstream 1.4
 * MEMORY_AND_LEARNING_REVIEW.md edge cases D1 / D3
 *
 * Confidence decays as a *read-time computation* (decay option A): the stored
 * `confidence` on a memory item is its reinforced value and never mutates;
 * `effectiveConfidence()` applies age-based decay when the item is read.
 *
 * Why read-time rather than a mutating cron:
 *   - no double-decay risk (a cron re-applying decay to an already-decayed
 *     value compounds incorrectly — D3)
 *   - no schema column needed to preserve the original confidence
 *   - reinforcement simply raises stored confidence; decay is recomputed
 *
 * A half-life model: confidence falls toward a floor, halving the remaining
 * gap every `halfLife` days. `permanent` claims never decay.
 *
 * Pure module. No DB, no LLM.
 */

export type DecayClass = "permanent" | "slow" | "fast" | "ephemeral";

/** Half-life in days per decay class. `null` = never decays. */
export const HALF_LIFE_DAYS: Record<DecayClass, number | null> = {
  permanent: null,
  slow: 730, // ~2 years — market structure, durable capabilities
  fast: 90, // ~3 months — competitor moves, pricing
  ephemeral: 14, // ~2 weeks — news, transient signals
};

/** Confidence decays toward this floor, never below it. */
export const CONFIDENCE_FLOOR = 0.1;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Whole-and-fractional days between `from` and `now` (default: current time).
 * Negative inputs (a future `from`) clamp to 0.
 */
export function ageInDays(from: Date, now: Date = new Date()): number {
  const ms = now.getTime() - from.getTime();
  return ms <= 0 ? 0 : ms / MS_PER_DAY;
}

/**
 * The effective (decayed) confidence of a claim, given its stored confidence,
 * decay class, and age in days.
 *
 *   effective = floor + (stored − floor) · 0.5 ^ (age / halfLife)
 *
 * - `permanent` claims return stored confidence unchanged
 * - a claim already at or below the floor is returned unchanged (decay never
 *   raises confidence)
 * - the result is always in [floor, stored]
 */
export function effectiveConfidence(
  storedConfidence: number,
  decayClass: DecayClass,
  ageDays: number,
): number {
  const stored = clamp01(storedConfidence);
  const halfLife = HALF_LIFE_DAYS[decayClass];

  // Permanent, or already at/below the floor — nothing to decay.
  if (halfLife === null || stored <= CONFIDENCE_FLOOR) return stored;

  const age = ageDays <= 0 ? 0 : ageDays;
  const retained = Math.pow(0.5, age / halfLife); // 1 → 0 as age grows
  const effective = CONFIDENCE_FLOOR + (stored - CONFIDENCE_FLOOR) * retained;

  // Guard the bounds against floating-point drift.
  if (effective > stored) return stored;
  if (effective < CONFIDENCE_FLOOR) return CONFIDENCE_FLOOR;
  return effective;
}

/** Convenience: effective confidence of an item from its ingestion date. */
export function effectiveConfidenceAsOf(
  storedConfidence: number,
  decayClass: DecayClass,
  ingestedAt: Date,
  now: Date = new Date(),
): number {
  return effectiveConfidence(storedConfidence, decayClass, ageInDays(ingestedAt, now));
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}
