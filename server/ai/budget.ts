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
 * Per-model pricing in USD per 1M tokens. Resolved by longest-prefix match so
 * dated snapshots (claude-haiku-4-5-20251001) and provider-prefixed labels
 * still hit the right row. "default" preserves the original conservative
 * GPT-4o-class rate for unknown models and legacy call sites.
 */
const PRICING_PER_MTOK: Record<string, { input: number; output: number }> = {
  "claude-fable-5": { input: 10.0, output: 50.0 },
  "claude-haiku-4-5": { input: 1.0, output: 5.0 },
  "gemini-2.5-flash": { input: 0.30, output: 2.50 },
  "gpt-5.6": { input: 5.0, output: 30.0 },        // Sol (alias gpt-5.6)
  "gpt-5.6-terra": { input: 2.5, output: 15.0 },
  "gpt-5.6-luna": { input: 1.0, output: 6.0 },
  "gpt-4o-mini": { input: 0.15, output: 0.60 },
  "text-embedding-3-small": { input: 0.02, output: 0 },
  "text-embedding-3-large": { input: 0.13, output: 0 },
  default: { input: 5.0, output: 15.0 },
};

function resolvePricing(model?: string): { input: number; output: number } {
  if (model) {
    let bestKey = "";
    for (const key of Object.keys(PRICING_PER_MTOK)) {
      if (key !== "default" && model.includes(key) && key.length > bestKey.length) {
        bestKey = key;
      }
    }
    if (bestKey) return PRICING_PER_MTOK[bestKey];
  }
  return PRICING_PER_MTOK["default"];
}

/**
 * Estimate cost from token counts. When a model is provided, uses its actual
 * pricing; otherwise falls back to the conservative default rate (previous
 * behavior — existing call sites without a model argument are unaffected).
 */
export function estimateCost(inputTokens: number, outputTokens: number, model?: string): number {
  const rate = resolvePricing(model);
  return (inputTokens * rate.input + outputTokens * rate.output) / 1_000_000;
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
