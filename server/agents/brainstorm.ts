/**
 * Brainstorm Mode — IMPLEMENTATION_PLAN.md Phase 4, Workstream 4.2
 *
 * A structured brainstorm runs through four phases — Diverge, Probe, Sharpen,
 * Lock — each with its own facilitation stance. As the session unfolds, five
 * silent extractors capture the raw material: hypotheses, options,
 * assumptions, risks, and open questions. At session close a recap names the
 * recurring themes, the unresolved threads, and the suggested next moves.
 *
 * The realtime voice CHANNEL (Workstream 4.1) is a separate, infra-gated
 * abstraction. This module is the brainstorm INTELLIGENCE — it operates on a
 * session transcript and is fully exercisable from typed or dictated text.
 */

import * as router from "../ai/router";
import type { RouterContext } from "../ai/router";

// ─────────────────────────────────────────────────────────────────────────────
// PHASE STATE MACHINE
// ─────────────────────────────────────────────────────────────────────────────

export type BrainstormPhaseId = "diverge" | "probe" | "sharpen" | "lock";

export interface BrainstormPhase {
  id: BrainstormPhaseId;
  label: string;
  /** What this phase is for. */
  goal: string;
  /** The facilitation stance the model should take in this phase. */
  facilitation: string;
}

export const BRAINSTORM_PHASES: readonly BrainstormPhase[] = [
  {
    id: "diverge",
    label: "Diverge",
    goal: "Generate many possibilities without judging them.",
    facilitation:
      "Open the space wide. Offer unexpected angles, adjacent moves, and " +
      "contrarian framings. Never evaluate or narrow yet — quantity over quality.",
  },
  {
    id: "probe",
    label: "Probe",
    goal: "Dig into the most promising threads.",
    facilitation:
      "Ask why. Surface the assumptions under each idea, the conditions it " +
      "needs, and the evidence for and against it. Follow the energy.",
  },
  {
    id: "sharpen",
    label: "Sharpen",
    goal: "Narrow to the strongest options and pressure-test them.",
    facilitation:
      "Compare options head to head. Name trade-offs, second-order effects, " +
      "and what would have to be true. Be a constructive sceptic.",
  },
  {
    id: "lock",
    label: "Lock",
    goal: "Commit to a direction and name the next actions.",
    facilitation:
      "Converge. State the chosen direction plainly, the rationale, and the " +
      "concrete next moves. Flag what is still unresolved.",
  },
] as const;

/** The next phase in the sequence, or null if already at Lock. Pure. */
export function nextPhase(current: BrainstormPhaseId): BrainstormPhaseId | null {
  const idx = BRAINSTORM_PHASES.findIndex((p) => p.id === current);
  if (idx < 0 || idx >= BRAINSTORM_PHASES.length - 1) return null;
  return BRAINSTORM_PHASES[idx + 1].id;
}

/** Look up a phase by id. Pure. */
export function getPhase(id: BrainstormPhaseId): BrainstormPhase {
  return BRAINSTORM_PHASES.find((p) => p.id === id) ?? BRAINSTORM_PHASES[0];
}

// ─────────────────────────────────────────────────────────────────────────────
// CAPTURE TYPES
// ─────────────────────────────────────────────────────────────────────────────

/** The five silent extractors' output. */
export interface BrainstormCaptures {
  hypotheses: string[];
  options: string[];
  assumptions: string[];
  risks: string[];
  openQuestions: string[];
}

export interface BrainstormRecap {
  /** The narrative recap — themes returned to, things assumed, what is unresolved. */
  recap: string;
  /** Concrete next moves the platform can act on. */
  suggestedMoves: string[];
}

const MAX_PER_CATEGORY = 15;
const MAX_MOVES = 6;

// ─────────────────────────────────────────────────────────────────────────────
// SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────

const CAPTURE_SCHEMA = {
  name: "brainstorm_captures",
  strict: false,
  schema: {
    type: "object",
    properties: {
      hypotheses: { type: "array", items: { type: "string" }, description: "Claims the session believes might be true." },
      options: { type: "array", items: { type: "string" }, description: "Distinct courses of action raised." },
      assumptions: { type: "array", items: { type: "string" }, description: "Things taken for granted." },
      risks: { type: "array", items: { type: "string" }, description: "Things that could go wrong." },
      openQuestions: { type: "array", items: { type: "string" }, description: "Questions left unanswered." },
    },
    required: ["hypotheses", "options", "assumptions", "risks", "openQuestions"],
  },
} as const;

const RECAP_SCHEMA = {
  name: "brainstorm_recap",
  strict: false,
  schema: {
    type: "object",
    properties: {
      recap: {
        type: "string",
        description:
          "A short recap: themes returned to, things assumed, what is unresolved.",
      },
      suggestedMoves: {
        type: "array",
        items: { type: "string" },
        description: "Concrete next moves, e.g. 'Deep research on X', 'War-game option 2'.",
      },
    },
    required: ["recap"],
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// DEFENSIVE PARSING
// ─────────────────────────────────────────────────────────────────────────────

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" && v.trim() ? v.trim() : fallback;
}

function asStringList(v: unknown, cap: number): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of v) {
    const s = asString(item);
    if (!s) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
    if (out.length >= cap) break;
  }
  return out;
}

/** Normalise the raw capture payload. Exported for tests. */
export function normalizeCaptures(raw: unknown): BrainstormCaptures {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    hypotheses: asStringList(o.hypotheses, MAX_PER_CATEGORY),
    options: asStringList(o.options, MAX_PER_CATEGORY),
    assumptions: asStringList(o.assumptions, MAX_PER_CATEGORY),
    risks: asStringList(o.risks, MAX_PER_CATEGORY),
    openQuestions: asStringList(o.openQuestions, MAX_PER_CATEGORY),
  };
}

/** Total number of captured items across all five categories. Pure. */
export function captureCount(c: BrainstormCaptures): number {
  return (
    c.hypotheses.length +
    c.options.length +
    c.assumptions.length +
    c.risks.length +
    c.openQuestions.length
  );
}

/** Normalise the raw recap payload. Exported for tests. */
export function normalizeRecap(raw: unknown): BrainstormRecap {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    recap: asString(o.recap, "The brainstorm produced no clear recap."),
    suggestedMoves: asStringList(o.suggestedMoves, MAX_MOVES),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// EXTRACTION + RECAP
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run the five silent extractors over a brainstorm transcript. Best-effort —
 * returns empty captures on failure.
 */
export async function extractBrainstormCaptures(
  transcript: string,
  ctx: RouterContext,
): Promise<BrainstormCaptures> {
  const empty: BrainstormCaptures = {
    hypotheses: [],
    options: [],
    assumptions: [],
    risks: [],
    openQuestions: [],
  };
  if (!transcript.trim()) return empty;

  try {
    const result = await router.structured<Record<string, unknown>>({
      task: "creative",
      messages: [
        {
          role: "system",
          content:
            "You silently capture the raw material of a strategy brainstorm. " +
            "From the transcript, extract five lists: hypotheses (claims that " +
            "might be true), options (distinct courses of action), assumptions " +
            "(things taken for granted), risks (what could go wrong), and open " +
            "questions (left unanswered). Be faithful to what was actually said " +
            "— do not invent. Keep each item to one crisp sentence.",
        },
        { role: "user", content: `BRAINSTORM TRANSCRIPT:\n${transcript}` },
      ],
      schema: CAPTURE_SCHEMA as unknown as {
        name: string;
        strict?: boolean;
        schema: Record<string, unknown>;
      },
      ctx,
    });
    return normalizeCaptures(result.data);
  } catch {
    return empty;
  }
}

function renderCaptures(c: BrainstormCaptures): string {
  const section = (label: string, items: string[]) =>
    items.length ? `${label}:\n${items.map((i) => `- ${i}`).join("\n")}` : "";
  return [
    section("Hypotheses", c.hypotheses),
    section("Options", c.options),
    section("Assumptions", c.assumptions),
    section("Risks", c.risks),
    section("Open questions", c.openQuestions),
  ]
    .filter(Boolean)
    .join("\n\n");
}

/**
 * Generate the session recap card. Best-effort — returns a default recap on
 * failure.
 */
export async function generateRecap(
  transcript: string,
  captures: BrainstormCaptures,
  ctx: RouterContext,
): Promise<BrainstormRecap> {
  try {
    const result = await router.structured<Record<string, unknown>>({
      task: "creative",
      messages: [
        {
          role: "system",
          content:
            "You close a strategy brainstorm with a sharp recap. Name the " +
            "themes the session kept returning to, the load-bearing " +
            "assumptions, and what is still unresolved. Then suggest a few " +
            "concrete next moves the platform can run (deep research, " +
            "option analysis, war-game, red-team). Be specific and brief.",
        },
        {
          role: "user",
          content:
            `BRAINSTORM TRANSCRIPT:\n${transcript}\n\n` +
            `CAPTURED MATERIAL:\n${renderCaptures(captures) || "(none captured)"}`,
        },
      ],
      schema: RECAP_SCHEMA as unknown as {
        name: string;
        strict?: boolean;
        schema: Record<string, unknown>;
      },
      ctx,
    });
    return normalizeRecap(result.data);
  } catch {
    return { recap: "The brainstorm recap could not be generated.", suggestedMoves: [] };
  }
}
