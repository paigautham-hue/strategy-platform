/**
 * Per-call budget enforcer — P8, C3
 *
 * Applies a (token, time, dollar) envelope on every LLM call.
 * - Warn at 80% of soft cap
 * - Block at 100% of soft cap
 * - Hard-kill at 1.5× the per-call estimate (no override path)
 */

export interface BudgetEnvelope {
  /** Max input tokens allowed */
  maxInputTokens: number;
  /** Max output tokens allowed */
  maxOutputTokens: number;
  /** Max wall-clock time in ms */
  maxLatencyMs: number;
  /** Soft dollar cap per call */
  softCapUsd: number;
  /** Hard-kill at 1.5× this estimate */
  estimatedCostUsd: number;
}

export interface BudgetCheckResult {
  allowed: boolean;
  warn: boolean;
  reason?: string;
  hardKill: boolean;
}

// Default per-call envelope (conservative Phase 0 defaults)
export const DEFAULT_ENVELOPE: BudgetEnvelope = {
  maxInputTokens: 8_000,
  maxOutputTokens: 4_000,
  maxLatencyMs: 60_000,
  softCapUsd: 0.10,
  estimatedCostUsd: 0.05,
};

// Hard-kill multiplier — strictly 1.5×, no override
const HARD_KILL_MULTIPLIER = 1.5;
const WARN_THRESHOLD = 0.8;

/**
 * Check if a proposed call is within budget before sending to LLM.
 */
export function checkBudget(
  inputTokens: number,
  estimatedOutputTokens: number,
  estimatedCostUsd: number,
  envelope: BudgetEnvelope = DEFAULT_ENVELOPE
): BudgetCheckResult {
  const hardKillCost = envelope.estimatedCostUsd * HARD_KILL_MULTIPLIER;

  // Hard-kill: strictly 1.5× estimate, no override
  if (estimatedCostUsd > hardKillCost) {
    return {
      allowed: false,
      warn: false,
      hardKill: true,
      reason: `Hard-kill: estimated cost $${estimatedCostUsd.toFixed(4)} exceeds 1.5× envelope ($${hardKillCost.toFixed(4)})`,
    };
  }

  // Block at 100% of soft cap
  if (estimatedCostUsd >= envelope.softCapUsd) {
    return {
      allowed: false,
      warn: false,
      hardKill: false,
      reason: `Blocked: estimated cost $${estimatedCostUsd.toFixed(4)} meets or exceeds soft cap $${envelope.softCapUsd.toFixed(4)}`,
    };
  }

  // Token limits
  if (inputTokens > envelope.maxInputTokens) {
    return {
      allowed: false,
      warn: false,
      hardKill: false,
      reason: `Blocked: input tokens ${inputTokens} exceeds limit ${envelope.maxInputTokens}`,
    };
  }

  if (estimatedOutputTokens > envelope.maxOutputTokens) {
    return {
      allowed: false,
      warn: false,
      hardKill: false,
      reason: `Blocked: estimated output tokens ${estimatedOutputTokens} exceeds limit ${envelope.maxOutputTokens}`,
    };
  }

  // Warn at 80% of soft cap
  const warn = estimatedCostUsd >= envelope.softCapUsd * WARN_THRESHOLD;

  return { allowed: true, warn, hardKill: false };
}

/**
 * Estimate cost from token counts.
 * Uses conservative pricing for the Manus built-in LLM.
 * Update these rates when actual pricing is known.
 */
export function estimateCost(inputTokens: number, outputTokens: number): number {
  // Conservative estimates (GPT-4o class pricing)
  const INPUT_RATE = 0.000005;  // $5 per 1M input tokens
  const OUTPUT_RATE = 0.000015; // $15 per 1M output tokens
  return inputTokens * INPUT_RATE + outputTokens * OUTPUT_RATE;
}

/**
 * Rough token estimator: ~4 chars per token for English text.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export class BudgetExceededError extends Error {
  constructor(
    public readonly reason: string,
    public readonly hardKill: boolean
  ) {
    super(`Budget exceeded: ${reason}`);
    this.name = "BudgetExceededError";
  }
}
