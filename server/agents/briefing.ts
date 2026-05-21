/**
 * Voice Briefing Builder — IMPLEMENTATION_PLAN.md Phase 7, Workstream 7.6
 *
 * A daily or weekly briefing synthesises the platform's recent signals —
 * predictions logged, drift, open questions — into a board-style read with a
 * sharp "what needs your attention" section. Briefing-default (H6): the
 * synthesis leads, the raw signals sit underneath.
 *
 * This is the briefing TEXT builder. The TTS audio digest and the realtime
 * "pause and ask a follow-up" interaction (Workstream 7.6 voice path) are
 * infra-gated — they layer on top of this.
 */

import * as router from "../ai/router";
import type { RouterContext } from "../ai/router";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type BriefingCadence = "daily" | "weekly";

export interface BriefingSection {
  heading: string;
  body: string;
}

export interface Briefing {
  cadence: BriefingCadence;
  /** The one-line headline a busy reader needs. */
  headline: string;
  sections: BriefingSection[];
  /** What needs the reader's attention — the default-view priority list. */
  needsAttention: string[];
  /** Concrete next moves. */
  suggestedActions: string[];
}

const MAX_SECTIONS = 6;
const MAX_LIST = 8;

// ─────────────────────────────────────────────────────────────────────────────
// SCHEMA
// ─────────────────────────────────────────────────────────────────────────────

const BRIEFING_SCHEMA = {
  name: "voice_briefing",
  strict: false,
  schema: {
    type: "object",
    properties: {
      headline: { type: "string", description: "The one-line headline." },
      sections: {
        type: "array",
        items: {
          type: "object",
          properties: {
            heading: { type: "string" },
            body: { type: "string" },
          },
          required: ["heading", "body"],
        },
      },
      needsAttention: {
        type: "array",
        items: { type: "string" },
        description: "What needs the reader's attention, most urgent first.",
      },
      suggestedActions: { type: "array", items: { type: "string" } },
    },
    required: ["headline"],
  },
} as const;

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
    if (out.length >= MAX_LIST) break;
  }
  return out;
}

function asSections(v: unknown): BriefingSection[] {
  if (!Array.isArray(v)) return [];
  const out: BriefingSection[] = [];
  for (const item of v) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const body = asString(o.body);
    if (!body) continue;
    out.push({ heading: asString(o.heading, "Update"), body });
    if (out.length >= MAX_SECTIONS) break;
  }
  return out;
}

/** Normalise raw LLM output into a Briefing. Exported for tests. */
export function normalizeBriefing(raw: unknown, cadence: BriefingCadence): Briefing {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    cadence,
    headline: asString(o.headline, "No briefing headline was produced."),
    sections: asSections(o.sections),
    needsAttention: asStringList(o.needsAttention),
    suggestedActions: asStringList(o.suggestedActions),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// BUILDER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a daily or weekly briefing from a block of recent signals. Best-effort
 * — returns a minimal briefing on failure.
 */
export async function buildBriefing(
  cadence: BriefingCadence,
  scope: string,
  signals: string,
  ctx: RouterContext,
): Promise<Briefing> {
  const window = cadence === "daily" ? "the last day" : "the last week";

  try {
    const result = await router.structured<Record<string, unknown>>({
      messages: [
        {
          role: "system",
          content:
            `You build a ${cadence} strategy briefing covering ${window}. ` +
            "Lead with a sharp one-line headline. Group the signals into a few " +
            "labelled sections. Then give a 'what needs your attention' list, " +
            "most urgent first, and concrete suggested actions. Be board-style: " +
            "concise, prioritised, no filler. If the signals are thin, a short " +
            "briefing is correct.",
        },
        {
          role: "user",
          content:
            `BRIEFING SCOPE: ${scope}\n\n` +
            `RECENT SIGNALS (${window}):\n${signals.trim() || "(no signals recorded)"}`,
        },
      ],
      schema: BRIEFING_SCHEMA as unknown as {
        name: string;
        strict?: boolean;
        schema: Record<string, unknown>;
      },
      ctx,
    });
    return normalizeBriefing(result.data, cadence);
  } catch {
    return {
      cadence,
      headline: "The briefing could not be generated.",
      sections: [],
      needsAttention: [],
      suggestedActions: [],
    };
  }
}
