/**
 * Voice Intent Parser — IMPLEMENTATION_PLAN.md Workstream 1.5
 *
 * One-shot voice intake: the browser transcribes speech to text (Web Speech
 * API — no audio upload), and this module parses that transcript into a
 * structured project intent — a clean name and description for a new
 * StrategyProject. Mirrors Meridian's parseVoiceIntent: a strict structured
 * LLM call (C3) with a Pydantic-equivalent defensive parse + a confidence
 * the UI uses to decide auto-fill vs. confirm.
 */

import * as router from "../ai/router";
import type { RouterContext } from "../ai/router";

export interface VoiceIntent {
  /** A concise project name derived from the spoken request. */
  projectName: string;
  /** A fuller description of the strategic question / engagement. */
  projectDescription: string;
  /** One-line restatement of what the user asked for. */
  summary: string;
  /** Parser confidence that the transcript is a clear project request. */
  confidence: "high" | "medium" | "low";
}

const CONFIDENCE_VALUES: readonly VoiceIntent["confidence"][] = ["high", "medium", "low"];

const INTENT_SCHEMA = {
  name: "voice_project_intent",
  strict: false,
  schema: {
    type: "object",
    properties: {
      projectName: {
        type: "string",
        description: "A concise (≤ 8 word) strategy project name capturing the request.",
      },
      projectDescription: {
        type: "string",
        description: "A 1-3 sentence description of the strategic question or engagement.",
      },
      summary: { type: "string", description: "One-line restatement of the request." },
      confidence: {
        type: "string",
        enum: ["high", "medium", "low"],
        description: "How clearly the transcript expresses a strategy project request.",
      },
    },
    required: ["projectName", "projectDescription", "confidence"],
  },
} as const;

const SYSTEM_INSTRUCTION =
  "You convert a spoken request into a strategy project. The user has dictated " +
  "a strategic question or engagement they want to start. Produce a concise " +
  "project name, a 1-3 sentence description, and a one-line summary. If the " +
  "transcript is vague or off-topic, still produce your best guess and set " +
  "confidence to low.";

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" && v.trim() ? v.trim() : fallback;
}

/**
 * Normalise raw LLM output into a VoiceIntent. Exported for unit testing.
 */
export function normalizeVoiceIntent(raw: unknown, transcript: string): VoiceIntent {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const confStr = asString(o.confidence);
  const confidence: VoiceIntent["confidence"] = (
    CONFIDENCE_VALUES as readonly string[]
  ).includes(confStr)
    ? (confStr as VoiceIntent["confidence"])
    : "low";

  // Fall back to the transcript itself so a project is always creatable.
  const fallbackName = transcript.trim().split(/\s+/).slice(0, 8).join(" ") || "Untitled project";
  return {
    projectName: asString(o.projectName, fallbackName).slice(0, 255),
    projectDescription: asString(o.projectDescription, transcript.trim()),
    summary: asString(o.summary, asString(o.projectDescription, transcript.trim())),
    confidence,
  };
}

/**
 * Parse a voice transcript into a structured strategy-project intent.
 * Best-effort: on LLM failure, returns a low-confidence intent built from
 * the transcript so the user can still proceed.
 */
export async function parseVoiceIntent(
  transcript: string,
  ctx: RouterContext,
): Promise<VoiceIntent> {
  const clean = transcript.trim();
  if (!clean) {
    return {
      projectName: "Untitled project",
      projectDescription: "",
      summary: "",
      confidence: "low",
    };
  }
  try {
    const result = await router.structured<Record<string, unknown>>({
      messages: [
        { role: "system", content: SYSTEM_INSTRUCTION },
        { role: "user", content: clean },
      ],
      schema: INTENT_SCHEMA as unknown as {
        name: string;
        strict?: boolean;
        schema: Record<string, unknown>;
      },
      ctx,
    });
    return normalizeVoiceIntent(result.data, clean);
  } catch {
    return normalizeVoiceIntent({}, clean);
  }
}
