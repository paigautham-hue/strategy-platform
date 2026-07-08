/**
 * Memo Dictation — IMPLEMENTATION_PLAN.md Phase 4, Workstream 4.5
 *
 * A GP thinks out loud for three minutes; the platform turns that monologue
 * into a clean one-page strategy memo — an executive summary, a few labelled
 * sections, the decisions taken, and the next actions. Briefing-default (H6):
 * structure first, raw transcript second.
 *
 * Operates on typed or browser-dictated text — the realtime voice channel
 * (Workstream 4.1) is a separate, infra-gated abstraction.
 */

import * as router from "../ai/router";
import type { RouterContext } from "../ai/router";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface MemoSection {
  heading: string;
  body: string;
}

export interface StructuredMemo {
  title: string;
  /** A 1-3 sentence executive summary. */
  executiveSummary: string;
  /** The labelled body of the memo. */
  sections: MemoSection[];
  /** Decisions taken or proposed in the monologue. */
  decisions: string[];
  /** Concrete next actions. */
  nextActions: string[];
}

const MAX_SECTIONS = 8;
const MAX_LIST = 10;

// ─────────────────────────────────────────────────────────────────────────────
// SCHEMA
// ─────────────────────────────────────────────────────────────────────────────

const MEMO_SCHEMA = {
  name: "structured_memo",
  strict: false,
  schema: {
    type: "object",
    properties: {
      title: { type: "string", description: "A short, specific memo title." },
      executiveSummary: {
        type: "string",
        description: "1-3 sentences — the gist a busy reader needs.",
      },
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
        description: "The labelled body — situation, analysis, options, etc.",
      },
      decisions: {
        type: "array",
        items: { type: "string" },
        description: "Decisions taken or proposed.",
      },
      nextActions: {
        type: "array",
        items: { type: "string" },
        description: "Concrete next actions.",
      },
    },
    required: ["title", "executiveSummary", "sections"],
  },
} as const;

const SYSTEM_INSTRUCTION =
  "You turn a raw dictated monologue into a clean one-page strategy memo. " +
  "Be faithful to what was said — do not invent facts or recommendations. " +
  "Write a short specific title, a 1-3 sentence executive summary, a few " +
  "labelled sections, the decisions, and the next actions. Tighten rambling " +
  "into crisp prose; drop filler and false starts. If the monologue is thin, " +
  "a short memo is correct — do not pad.";

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

function asSections(v: unknown): MemoSection[] {
  if (!Array.isArray(v)) return [];
  const out: MemoSection[] = [];
  for (const item of v) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const body = asString(o.body);
    if (!body) continue;
    out.push({ heading: asString(o.heading, "Notes"), body });
    if (out.length >= MAX_SECTIONS) break;
  }
  return out;
}

/** Normalise raw LLM output into a StructuredMemo. Exported for tests. */
export function normalizeMemo(raw: unknown): StructuredMemo {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    title: asString(o.title, "Untitled memo"),
    executiveSummary: asString(o.executiveSummary, "No summary was produced."),
    sections: asSections(o.sections),
    decisions: asStringList(o.decisions),
    nextActions: asStringList(o.nextActions),
  };
}

/** Render a StructuredMemo as plain markdown. Pure — exported for tests. */
export function renderMemoMarkdown(memo: StructuredMemo): string {
  const lines = [`# ${memo.title}`, "", memo.executiveSummary, ""];
  for (const s of memo.sections) {
    lines.push(`## ${s.heading}`, "", s.body, "");
  }
  if (memo.decisions.length) {
    lines.push("## Decisions", "", ...memo.decisions.map((d) => `- ${d}`), "");
  }
  if (memo.nextActions.length) {
    lines.push("## Next actions", "", ...memo.nextActions.map((a) => `- ${a}`), "");
  }
  return lines.join("\n").trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// STRUCTURING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Structure a dictated monologue into a one-page memo. Best-effort — returns
 * a minimal memo carrying the raw transcript on failure, so nothing is lost.
 */
export async function structureMemo(
  transcript: string,
  ctx: RouterContext,
): Promise<StructuredMemo> {
  if (!transcript.trim()) {
    return {
      title: "Empty memo",
      executiveSummary: "No content was dictated.",
      sections: [],
      decisions: [],
      nextActions: [],
    };
  }

  try {
    const result = await router.structured<Record<string, unknown>>({
      task: "extraction",
      messages: [
        { role: "system", content: SYSTEM_INSTRUCTION },
        { role: "user", content: `DICTATED MONOLOGUE:\n${transcript}` },
      ],
      schema: MEMO_SCHEMA as unknown as {
        name: string;
        strict?: boolean;
        schema: Record<string, unknown>;
      },
      ctx,
    });
    return normalizeMemo(result.data);
  } catch {
    return {
      title: "Memo (unstructured)",
      executiveSummary: "The memo could not be structured — the raw transcript is preserved below.",
      sections: [{ heading: "Raw transcript", body: transcript.trim() }],
      decisions: [],
      nextActions: [],
    };
  }
}
