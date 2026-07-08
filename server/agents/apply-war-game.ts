/**
 * Share-and-Apply Micro War-Game — IMPLEMENTATION_PLAN.md Phase 3, Workstream 3.5
 * Heuristic H13 deep mode
 *
 * Phase 2's Share-and-Apply pipeline adapts an external strategy artifact to a
 * specific portfolio company. "Deep mode" stress-tests that adapted strategy:
 * it plays the adapted moves out as a quick (2-round) war-game in the target
 * company's context, then compares how the simulation actually played out
 * against what the artifact claimed to expect.
 *
 * The micro war-game reuses the Workstream 3.4 engine — its outcome is
 * SYNTHETIC and the caller records it to the prediction ledger accordingly.
 */

import * as router from "../ai/router";
import type { RouterContext } from "../ai/router";
import type { StrategyArtifact } from "../services/strategy-artifact";
import type { StrategyApplication } from "./apply-strategy";
import { runWarGame, type WarGameResult } from "./war-game";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

/** How the simulated outcome lines up with the artifact's expected outcomes. */
export type DeepModeAlignment = "aligned" | "partial" | "diverges";

export interface DeepModeComparison {
  alignment: DeepModeAlignment;
  /** The "Simulated outcome vs expected" narrative. */
  comparison: string;
  /** The apply recommendation, revised in light of the simulation. */
  adjustedRecommendation: string;
}

export interface ApplyDeepModeResult {
  warGame: WarGameResult;
  comparison: DeepModeComparison;
}

/** A micro war-game is deliberately quick — fewer rounds than a full game. */
const MICRO_WAR_GAME_ROUNDS = 2;

const ALIGNMENTS: readonly DeepModeAlignment[] = ["aligned", "partial", "diverges"];

// ─────────────────────────────────────────────────────────────────────────────
// SCHEMA
// ─────────────────────────────────────────────────────────────────────────────

const COMPARE_SCHEMA = {
  name: "deep_mode_comparison",
  strict: false,
  schema: {
    type: "object",
    properties: {
      alignment: {
        type: "string",
        enum: ["aligned", "partial", "diverges"],
        description: "Does the simulated outcome match the artifact's expected outcomes?",
      },
      comparison: {
        type: "string",
        description: "Simulated outcome vs expected — where they agree and where they diverge.",
      },
      adjustedRecommendation: {
        type: "string",
        description: "The apply recommendation, revised given what the simulation revealed.",
      },
    },
    required: ["alignment", "comparison"],
  },
} as const;

const COMPARE_SYSTEM =
  "You compare a war-game simulation of an applied strategy against what the " +
  "original strategy artifact claimed to expect. Judge honestly whether the " +
  "simulated outcome is aligned, partial, or diverges from the expected " +
  "outcomes. Explain where they agree and where they part ways, and give a " +
  "recommendation revised in light of the simulation.";

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" && v.trim() ? v.trim() : fallback;
}

// ─────────────────────────────────────────────────────────────────────────────
// PURE HELPERS (exported for tests)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build the strategy text the micro war-game plays out. Prefers the adapted
 * moves (the strategy rewritten for this company); falls back to the
 * artifact's own key moves when no adaptation is available.
 */
export function buildAppliedStrategyText(
  artifact: StrategyArtifact,
  application: StrategyApplication,
): string {
  const adapted = application.adaptedMoves
    .map((m) => asString(m.adapted) || asString(m.original))
    .filter(Boolean);
  const moves = adapted.length > 0 ? adapted : artifact.keyMoves.filter(Boolean);

  const lines = [
    `Apply the strategy "${artifact.title}" to this company.`,
    `Core thesis: ${artifact.coreThesis}`,
  ];
  if (moves.length) {
    lines.push("Adapted moves for this company:");
    for (const m of moves) lines.push(`- ${m}`);
  }
  return lines.join("\n");
}

/** Normalise the raw comparison payload. Exported for tests. */
export function normalizeComparison(raw: unknown): DeepModeComparison {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const alignmentRaw = typeof o.alignment === "string" ? o.alignment.trim().toLowerCase() : "";
  const alignment = (ALIGNMENTS as readonly string[]).includes(alignmentRaw)
    ? (alignmentRaw as DeepModeAlignment)
    : "partial";
  return {
    alignment,
    comparison: asString(o.comparison, "The simulation produced no clear comparison."),
    adjustedRecommendation: asString(o.adjustedRecommendation, "No adjusted recommendation produced."),
  };
}

function renderWarGame(result: WarGameResult): string {
  const rounds = result.rounds
    .map(
      (r) =>
        `Round ${r.round}:\n` +
        (r.moves.length
          ? r.moves.map((m) => `  - ${m.stakeholderLabel}: ${m.move}`).join("\n")
          : "  (no moves)"),
    )
    .join("\n\n");
  const learnings = result.keyLearnings.length
    ? `\n\nKey learnings:\n${result.keyLearnings.map((l) => `- ${l}`).join("\n")}`
    : "";
  return (
    `${rounds}\n\nOutcome: ${result.outcome}\n` +
    `Survived: ${result.survived ? "yes" : "no"}${learnings}`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DEEP MODE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run the deep-mode micro war-game for an applied strategy and compare the
 * simulated outcome against the artifact's expected outcomes. Best-effort —
 * a failed comparison keeps the war-game result and the original
 * recommendation.
 */
export async function runApplyDeepMode(
  artifact: StrategyArtifact,
  application: StrategyApplication,
  companyId: number,
  ctx: RouterContext,
): Promise<ApplyDeepModeResult> {
  const strategyText = buildAppliedStrategyText(artifact, application);
  const warGame = await runWarGame(strategyText, companyId, ctx, MICRO_WAR_GAME_ROUNDS);

  let comparison: DeepModeComparison = {
    alignment: "partial",
    comparison: "The simulation produced no clear comparison.",
    adjustedRecommendation: application.recommendation,
  };

  const expected = artifact.expectedOutcomes.filter(Boolean);
  const user =
    `STRATEGY: ${artifact.title}\n` +
    `Original recommendation from the apply step: ${application.recommendation}\n\n` +
    `EXPECTED OUTCOMES (from the strategy artifact):\n` +
    (expected.length ? expected.map((e) => `- ${e}`).join("\n") : "(none stated)") +
    `\n\nHOW THE WAR-GAME PLAYED OUT:\n${renderWarGame(warGame)}`;

  try {
    const result = await router.structured<Record<string, unknown>>({
      task: "extraction",
      messages: [
        { role: "system", content: COMPARE_SYSTEM },
        { role: "user", content: user },
      ],
      schema: COMPARE_SCHEMA as unknown as {
        name: string;
        strict?: boolean;
        schema: Record<string, unknown>;
      },
      ctx,
    });
    comparison = normalizeComparison(result.data);
  } catch {
    /* keep the default comparison */
  }

  return { warGame, comparison };
}
