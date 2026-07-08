/**
 * Persona Registry + Consult — IMPLEMENTATION_PLAN.md Phase 4, Workstream 4.4
 *
 * The same strategic question lands differently depending on who you ask. The
 * persona registry holds a small cast of advisory stances — Coach, Challenger,
 * Devil's Advocate, Consultant, Chief-of-Staff — and `consultPersona` answers
 * a question grounded in company memory, in that persona's voice.
 *
 * The realtime mid-flight persona SWAP ("let me hear from the regulator") is a
 * separate, infra-gated abstraction (Workstream 4.4 voice path). This is the
 * text-based consult — fully exercisable today.
 */

import * as router from "../ai/router";
import type { RouterContext } from "../ai/router";
import { hybridSearchMemory } from "../services/memory-search";

// ─────────────────────────────────────────────────────────────────────────────
// REGISTRY
// ─────────────────────────────────────────────────────────────────────────────

export interface Persona {
  id: string;
  label: string;
  /** A one-line description for the picker. */
  description: string;
  /** The stance the model adopts when speaking as this persona. */
  stance: string;
}

export const PERSONAS: readonly Persona[] = [
  {
    id: "coach",
    label: "The Coach",
    description: "Draws out your own thinking with questions and encouragement.",
    stance:
      "You are a supportive strategy coach. Draw out the user's own thinking " +
      "with sharp questions. Affirm what is strong, name what is vague, and " +
      "leave the user with more clarity than they arrived with. Never lecture.",
  },
  {
    id: "challenger",
    label: "The Challenger",
    description: "Pushes hard, demands evidence, refuses comfortable answers.",
    stance:
      "You are a hard-nosed challenger. Demand evidence for every claim. " +
      "Refuse comfortable answers. Press on the weakest link until it holds " +
      "or breaks. Be direct, not cruel — the goal is a stronger strategy.",
  },
  {
    id: "devils_advocate",
    label: "The Devil's Advocate",
    description: "Argues the opposite case as forcefully as it can be made.",
    stance:
      "You are the devil's advocate. Argue the opposite of whatever the user " +
      "is leaning towards, as forcefully and honestly as that case can be " +
      "made. Make the strongest version of the counter-argument, then stop.",
  },
  {
    id: "consultant",
    label: "The Consultant",
    description: "Structured, MECE, framework-driven analysis.",
    stance:
      "You are a senior strategy consultant. Structure the answer cleanly — " +
      "MECE buckets, clear logic, named trade-offs. Diagnose before you " +
      "prescribe. Be rigorous but never hide behind jargon.",
  },
  {
    id: "chief_of_staff",
    label: "The Chief of Staff",
    description: "Execution-minded — turns talk into a concrete plan.",
    stance:
      "You are a chief of staff. Turn the discussion into a concrete plan: " +
      "who does what, by when, and how progress is checked. Surface the " +
      "dependencies and the first move. Bias hard towards action.",
  },
] as const;

/** Look up a persona by id; defaults to the Coach. Pure — exported for tests. */
export function getPersona(id: string): Persona {
  return PERSONAS.find((p) => p.id === id) ?? PERSONAS[0];
}

/** The picker-facing view of the registry (no stance prompt). Pure. */
export function listPersonas(): { id: string; label: string; description: string }[] {
  return PERSONAS.map((p) => ({ id: p.id, label: p.label, description: p.description }));
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSULT
// ─────────────────────────────────────────────────────────────────────────────

export interface PersonaConsult {
  personaId: string;
  personaLabel: string;
  /** The persona's answer, in their voice. */
  response: string;
  /** The few points worth keeping. */
  keyPoints: string[];
}

const MAX_KEY_POINTS = 6;

const CONSULT_SCHEMA = {
  name: "persona_consult",
  strict: false,
  schema: {
    type: "object",
    properties: {
      response: { type: "string", description: "The persona's answer, in their voice." },
      keyPoints: {
        type: "array",
        items: { type: "string" },
        description: "The few points worth keeping.",
      },
    },
    required: ["response"],
  },
} as const;

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" && v.trim() ? v.trim() : fallback;
}

/** Normalise the raw consult payload for a persona. Exported for tests. */
export function normalizeConsult(raw: unknown, persona: Persona): PersonaConsult {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const keyPoints: string[] = [];
  if (Array.isArray(o.keyPoints)) {
    for (const p of o.keyPoints) {
      const s = asString(p);
      if (s) keyPoints.push(s);
      if (keyPoints.length >= MAX_KEY_POINTS) break;
    }
  }
  return {
    personaId: persona.id,
    personaLabel: persona.label,
    response: asString(o.response, "The persona produced no response."),
    keyPoints,
  };
}

/**
 * Consult a persona on a question, grounded in company memory. Best-effort —
 * returns an empty response on failure.
 */
export async function consultPersona(
  personaId: string,
  question: string,
  companyId: number,
  ctx: RouterContext,
): Promise<PersonaConsult> {
  const persona = getPersona(personaId);

  let memoryContext = "";
  try {
    const memories = await hybridSearchMemory({
      tenantId: ctx.tenantId,
      companyId,
      query: question,
      limit: 12,
      ctx: { ...ctx, companyId },
    });
    memoryContext = memories.map((m, i) => `${i + 1}. ${m.canonicalForm}`).join("\n");
  } catch {
    memoryContext = "";
  }

  const user =
    `QUESTION:\n${question}\n\n` +
    (memoryContext ? `What the platform knows about the company:\n${memoryContext}` : "No company memory is available.");

  try {
    const result = await router.structured<Record<string, unknown>>({
      task: "extraction",
      messages: [
        { role: "system", content: persona.stance },
        { role: "user", content: user },
      ],
      schema: CONSULT_SCHEMA as unknown as {
        name: string;
        strict?: boolean;
        schema: Record<string, unknown>;
      },
      ctx,
    });
    return normalizeConsult(result.data, persona);
  } catch {
    return {
      personaId: persona.id,
      personaLabel: persona.label,
      response: "The consultation could not complete.",
      keyPoints: [],
    };
  }
}
