/**
 * War-Game Simulation — IMPLEMENTATION_PLAN.md Phase 3, Workstream 3.4
 *
 * A strategy is not trusted until it has been played out against the people
 * who will react to it. The war-game simulates stakeholder personas across
 * four arenas — customer, competitor, regulatory, capital — over several
 * rounds: round 1 reacts to the strategy itself, later rounds react to the
 * prior round's moves. An outcome assessment closes the game.
 *
 * War-game outcomes are SYNTHETIC (not real-world results) — the caller
 * records them to the prediction ledger with outcomeClass "synthetic" so the
 * calibration loop never mixes them with real outcomes (J4).
 */

import * as router from "../ai/router";
import type { RouterContext } from "../ai/router";
import { hybridSearchMemory } from "../services/memory-search";

// ─────────────────────────────────────────────────────────────────────────────
// STAKEHOLDERS
// ─────────────────────────────────────────────────────────────────────────────

export interface Stakeholder {
  id: string;
  label: string;
  arena: string;
  /** How this stakeholder behaves. */
  disposition: string;
}

export const STAKEHOLDERS: readonly Stakeholder[] = [
  {
    id: "customer",
    label: "Customer Archetype",
    arena: "customer",
    disposition: "adopts, defers, or defects based on value and switching cost",
  },
  {
    id: "competitor",
    label: "Competitor CEO",
    arena: "competitor",
    disposition: "retaliates to defend share — price, product, or messaging moves",
  },
  {
    id: "regulator",
    label: "Regulator",
    arena: "regulatory",
    disposition: "scrutinises, permits, or constrains based on rules and precedent",
  },
  {
    id: "investor",
    label: "Activist Investor",
    arena: "capital",
    disposition: "rewards or punishes via capital, pressure, and the narrative",
  },
] as const;

const DEFAULT_ROUNDS = 3;
const MAX_ROUNDS = 5;
const MAX_LEARNINGS = 8;

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface WarGameMove {
  stakeholder: string;
  stakeholderLabel: string;
  move: string;
}

export interface WarGameRound {
  round: number;
  moves: WarGameMove[];
}

export interface WarGameResult {
  strategy: string;
  rounds: WarGameRound[];
  outcome: string;
  /** Did the strategy hold up against the simulated reactions? */
  survived: boolean;
  keyLearnings: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────

const ROUND_SCHEMA = {
  name: "war_game_round",
  strict: false,
  schema: {
    type: "object",
    properties: {
      moves: {
        type: "array",
        items: {
          type: "object",
          properties: {
            stakeholder: { type: "string", enum: STAKEHOLDERS.map((s) => s.id) },
            move: { type: "string", description: "What this stakeholder does this round, and why." },
          },
          required: ["stakeholder", "move"],
        },
      },
    },
    required: ["moves"],
  },
} as const;

const OUTCOME_SCHEMA = {
  name: "war_game_outcome",
  strict: false,
  schema: {
    type: "object",
    properties: {
      outcome: { type: "string", description: "How the strategy fared once all reactions played out." },
      survived: { type: "boolean", description: "Did the strategy hold up?" },
      keyLearnings: { type: "array", items: { type: "string" } },
    },
    required: ["outcome", "survived"],
  },
} as const;

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" && v.trim() ? v.trim() : fallback;
}

/** Normalise one raw round payload. Exported for tests. */
export function normalizeRound(raw: unknown, roundNumber: number): WarGameRound {
  const list =
    raw && typeof raw === "object" && Array.isArray((raw as { moves?: unknown }).moves)
      ? (raw as { moves: unknown[] }).moves
      : [];
  const moves: WarGameMove[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const move = asString(o.move);
    if (!move) continue;
    const stakeholder = STAKEHOLDERS.find((s) => s.id === asString(o.stakeholder));
    moves.push({
      stakeholder: stakeholder?.id ?? "customer",
      stakeholderLabel: stakeholder?.label ?? "Customer Archetype",
      move,
    });
  }
  return { round: roundNumber, moves };
}

/** Normalise the raw outcome payload. Exported for tests. */
export function normalizeOutcome(raw: unknown): {
  outcome: string;
  survived: boolean;
  keyLearnings: string[];
} {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const learnings: string[] = [];
  if (Array.isArray(o.keyLearnings)) {
    for (const l of o.keyLearnings) {
      const s = asString(l);
      if (s) learnings.push(s);
      if (learnings.length >= MAX_LEARNINGS) break;
    }
  }
  return {
    outcome: asString(o.outcome, "The war-game produced no clear outcome."),
    survived: o.survived === true,
    keyLearnings: learnings,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SIMULATION
// ─────────────────────────────────────────────────────────────────────────────

function renderRounds(rounds: WarGameRound[]): string {
  return rounds
    .map(
      (r) =>
        `Round ${r.round}:\n` +
        r.moves.map((m) => `  - ${m.stakeholderLabel}: ${m.move}`).join("\n"),
    )
    .join("\n\n");
}

/**
 * Run a multi-round war-game for a strategy, grounded in company memory.
 * Best-effort — a failed round yields no moves but the game continues.
 */
export async function runWarGame(
  strategy: string,
  companyId: number,
  ctx: RouterContext,
  roundCount: number = DEFAULT_ROUNDS,
): Promise<WarGameResult> {
  const rounds = Math.max(1, Math.min(roundCount, MAX_ROUNDS));

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

  const stakeholderList = STAKEHOLDERS.map(
    (s) => `- ${s.id} (${s.label}, ${s.arena} arena): ${s.disposition}`,
  ).join("\n");

  const playedRounds: WarGameRound[] = [];
  for (let n = 1; n <= rounds; n++) {
    const system =
      "You run a strategy war-game. For the round, give EACH stakeholder's move — " +
      "what they do and why. Round 1 reacts to the strategy; later rounds react to " +
      `the prior round's moves and escalate realistically.\n\nStakeholders:\n${stakeholderList}`;
    const user =
      `Strategy under test:\n${strategy}\n\n` +
      (memoryContext ? `Company context:\n${memoryContext}\n\n` : "") +
      (playedRounds.length
        ? `Rounds so far:\n${renderRounds(playedRounds)}\n\nNow play round ${n}.`
        : `Play round ${n}.`);

    try {
      const result = await router.structured<Record<string, unknown>>({
        task: "planner",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        schema: ROUND_SCHEMA as unknown as {
          name: string;
          strict?: boolean;
          schema: Record<string, unknown>;
        },
        ctx,
      });
      playedRounds.push(normalizeRound(result.data, n));
    } catch {
      playedRounds.push({ round: n, moves: [] });
    }
  }

  // Outcome assessment.
  let outcome = { outcome: "The war-game produced no clear outcome.", survived: false, keyLearnings: [] as string[] };
  try {
    const result = await router.structured<Record<string, unknown>>({
      task: "planner",
      messages: [
        {
          role: "system",
          content:
            "You are the war-game adjudicator. Given the strategy and how the rounds " +
            "played out, judge the outcome: did the strategy hold up, and what are the " +
            "key learnings?",
        },
        {
          role: "user",
          content: `Strategy:\n${strategy}\n\nHow it played out:\n${renderRounds(playedRounds)}`,
        },
      ],
      schema: OUTCOME_SCHEMA as unknown as {
        name: string;
        strict?: boolean;
        schema: Record<string, unknown>;
      },
      ctx,
    });
    outcome = normalizeOutcome(result.data);
  } catch {
    /* keep the default outcome */
  }

  return {
    strategy,
    rounds: playedRounds,
    outcome: outcome.outcome,
    survived: outcome.survived,
    keyLearnings: outcome.keyLearnings,
  };
}
