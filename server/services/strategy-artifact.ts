/**
 * Strategy-Artifact Recognition — IMPLEMENTATION_PLAN.md Workstream 1.8
 *
 * The foundation of Share-and-Apply (H13): when a user drops in an external
 * strategy — an HBR article, a competitor's playbook, a book excerpt, a
 * framework write-up — this module recognises it as a strategy artifact and
 * extracts its reusable structure:
 *
 *   thesis · preconditions · key moves · expected outcomes · context · attribution
 *
 * This phase only RECOGNISES and STRUCTURES. Applying an artifact to a portco
 * (fit assessment, adaptation, the application memo) is Phase 2 (Workstream
 * 2.8). Recognition is a single structured LLM call (C3) with defensive
 * parsing — a malformed field degrades gracefully, never throws.
 */

import * as router from "../ai/router";
import type { RouterContext } from "../ai/router";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export const ARTIFACT_TYPES = [
  "framework",
  "playbook",
  "thesis",
  "case_study",
  "maxim",
] as const;
export type ArtifactType = (typeof ARTIFACT_TYPES)[number];

export interface StrategyArtifact {
  /** Did the classifier judge this text to be an external strategy artifact? */
  isStrategyArtifact: boolean;
  /** The kind of artifact, when recognised. */
  artifactType: ArtifactType | null;
  /** A short title for the artifact. */
  title: string;
  /** The central claim — what the artifact argues works. */
  coreThesis: string;
  /** What must be true for the strategy to apply (the fit-assessment inputs). */
  preconditions: string[];
  /** The prescribed actions / plays. */
  keyMoves: string[];
  /** What success looks like if the strategy is followed. */
  expectedOutcomes: string[];
  /** The business / era / market the artifact originated in. */
  contextOfOrigin: string;
  /** Author, source, or origin attribution. */
  attribution: string;
  /** Classifier confidence that this IS a strategy artifact, 0–1. */
  classifierConfidence: number;
}

/** Cap on list-field length — guards against runaway LLM output. */
const MAX_LIST_ITEMS = 15;

// ─────────────────────────────────────────────────────────────────────────────
// LLM SCHEMA
// ─────────────────────────────────────────────────────────────────────────────

const RECOGNITION_SCHEMA = {
  name: "strategy_artifact",
  strict: false,
  schema: {
    type: "object",
    properties: {
      isStrategyArtifact: {
        type: "boolean",
        description:
          "True if the text presents a reusable business strategy, framework, " +
          "playbook, thesis, case study, or strategic maxim.",
      },
      artifactType: {
        type: "string",
        enum: ["framework", "playbook", "thesis", "case_study", "maxim"],
      },
      title: { type: "string" },
      coreThesis: {
        type: "string",
        description: "The central claim — what this strategy argues works, in one or two sentences.",
      },
      preconditions: {
        type: "array",
        items: { type: "string" },
        description: "Conditions that must hold for the strategy to apply.",
      },
      keyMoves: {
        type: "array",
        items: { type: "string" },
        description: "The concrete actions or plays the strategy prescribes.",
      },
      expectedOutcomes: {
        type: "array",
        items: { type: "string" },
        description: "What success looks like if the strategy is followed.",
      },
      contextOfOrigin: {
        type: "string",
        description: "The company, industry, or era the artifact came from.",
      },
      attribution: { type: "string", description: "Author or source." },
      classifierConfidence: {
        type: "number",
        description: "Confidence (0-1) that this text is a strategy artifact.",
      },
    },
    required: ["isStrategyArtifact"],
  },
} as const;

const SYSTEM_INSTRUCTION =
  "You analyse business text to decide whether it is an external STRATEGY ARTIFACT " +
  "— a reusable framework, playbook, thesis, case study, or strategic maxim that " +
  "could be applied to another company. If it is, extract its reusable structure: " +
  "the core thesis, the preconditions for it to work, the key moves it prescribes, " +
  "the expected outcomes, its context of origin, and attribution. If the text is " +
  "ordinary content (news, data, narration) set isStrategyArtifact to false.";

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

function asConfidence(v: unknown): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return 0.5;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

/**
 * Normalise raw LLM output into a clean StrategyArtifact. Exported for tests —
 * defensive parsing is where recognition bugs hide.
 */
export function normalizeArtifactOutput(raw: unknown): StrategyArtifact {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;

  const isStrategyArtifact = o.isStrategyArtifact === true;

  const typeStr = asString(o.artifactType);
  const artifactType: ArtifactType | null =
    isStrategyArtifact && (ARTIFACT_TYPES as readonly string[]).includes(typeStr)
      ? (typeStr as ArtifactType)
      : null;

  return {
    isStrategyArtifact,
    artifactType,
    title: asString(o.title, "(untitled)"),
    coreThesis: asString(o.coreThesis),
    preconditions: asStringList(o.preconditions),
    keyMoves: asStringList(o.keyMoves),
    expectedOutcomes: asStringList(o.expectedOutcomes),
    contextOfOrigin: asString(o.contextOfOrigin),
    attribution: asString(o.attribution),
    classifierConfidence: asConfidence(o.classifierConfidence),
  };
}

/** A non-artifact result (used on classification failure or empty input). */
function notAnArtifact(): StrategyArtifact {
  return {
    isStrategyArtifact: false,
    artifactType: null,
    title: "(untitled)",
    coreThesis: "",
    preconditions: [],
    keyMoves: [],
    expectedOutcomes: [],
    contextOfOrigin: "",
    attribution: "",
    classifierConfidence: 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// RECOGNITION
// ─────────────────────────────────────────────────────────────────────────────

/** Max characters of source text sent to the recogniser. */
const MAX_INPUT_CHARS = 12_000;

/**
 * Recognise whether `text` is an external strategy artifact and, if so,
 * extract its reusable structure.
 *
 * Returns a non-artifact result on any LLM/parse failure — recognition is a
 * best-effort enrichment, never a hard dependency.
 */
export async function recognizeStrategyArtifact(
  text: string,
  ctx: RouterContext,
): Promise<StrategyArtifact> {
  if (!text.trim()) return notAnArtifact();
  try {
    const result = await router.structured<Record<string, unknown>>({
      messages: [
        { role: "system", content: SYSTEM_INSTRUCTION },
        { role: "user", content: text.slice(0, MAX_INPUT_CHARS) },
      ],
      schema: RECOGNITION_SCHEMA as unknown as {
        name: string;
        strict?: boolean;
        schema: Record<string, unknown>;
      },
      ctx,
    });
    return normalizeArtifactOutput(result.data);
  } catch {
    return notAnArtifact();
  }
}
