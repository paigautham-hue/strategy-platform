/**
 * Framework Library — IMPLEMENTATION_PLAN.md Phase 3, Workstream 3.1
 *
 * Eight strategy frameworks as structured agents. Frameworks are NOT a
 * user-facing menu (P4) — the Diagnosis agent classifies the question type
 * and `frameworksForQuestionType` selects which frameworks the Reasoning Mesh
 * applies. Each framework is grounded in the company's memory.
 *
 * All frameworks share one output shape (sections → points, plus a summary
 * and key implications); each framework's prompt makes the content specific.
 */

import * as router from "../ai/router";
import type { RouterContext } from "../ai/router";
import { hybridSearchMemory } from "../services/memory-search";
import type { QuestionType } from "./diagnosis";

// ─────────────────────────────────────────────────────────────────────────────
// FRAMEWORK REGISTRY
// ─────────────────────────────────────────────────────────────────────────────

export interface FrameworkDef {
  id: string;
  label: string;
  /** What the framework is for. */
  focus: string;
  /** Guidance to the LLM on how to structure the analysis sections. */
  sectionsHint: string;
}

export const FRAMEWORKS: readonly FrameworkDef[] = [
  {
    id: "porter_five_forces",
    label: "Porter's Five Forces",
    focus: "industry structure and the intensity of competition",
    sectionsHint:
      "one section per force — Competitive Rivalry, Threat of New Entrants, Threat of " +
      "Substitutes, Bargaining Power of Buyers, Bargaining Power of Suppliers",
  },
  {
    id: "ansoff_matrix",
    label: "Ansoff Matrix",
    focus: "the direction of growth",
    sectionsHint:
      "Market Penetration, Market Development, Product Development, Diversification — " +
      "assess the firm's position and the risk of each",
  },
  {
    id: "jtbd",
    label: "Jobs To Be Done",
    focus: "the underlying job the customer is hiring the product to do",
    sectionsHint: "Functional Job, Emotional & Social Job, Current Solutions, Unmet Needs",
  },
  {
    id: "wardley_map",
    label: "Wardley Map",
    focus: "the value chain and how its components are evolving",
    sectionsHint:
      "User Need, Value-Chain Components, Evolution Stage of each (genesis → custom → " +
      "product → commodity), Strategic Plays",
  },
  {
    id: "three_horizons",
    label: "Three Horizons",
    focus: "balancing today's core against tomorrow's growth and future options",
    sectionsHint:
      "Horizon 1 (defend & extend the core), Horizon 2 (build emerging businesses), " +
      "Horizon 3 (create viable options / bets)",
  },
  {
    id: "bcg_matrix",
    label: "BCG Growth-Share Matrix",
    focus: "portfolio allocation across business units or products",
    sectionsHint: "Stars, Cash Cows, Question Marks, Dogs — and the cash-flow implications",
  },
  {
    id: "blue_ocean",
    label: "Blue Ocean — Four Actions",
    focus: "creating uncontested market space",
    sectionsHint: "Eliminate, Reduce, Raise, Create — relative to the industry's factors",
  },
  {
    id: "disruption_lens",
    label: "Christensen Disruption Lens",
    focus: "sustaining vs disruptive competitive dynamics",
    sectionsHint:
      "Incumbent Trajectory, Low-End Footholds, New-Market Footholds, Disruption Risk & Response",
  },
] as const;

export type FrameworkId = (typeof FRAMEWORKS)[number]["id"];

/** Look up a framework definition by id. */
export function getFramework(id: string): FrameworkDef | undefined {
  return FRAMEWORKS.find((f) => f.id === id);
}

/** Which frameworks the Reasoning Mesh applies for each question type (P4). */
const FRAMEWORKS_BY_TYPE: Record<QuestionType, string[]> = {
  adjacency: ["ansoff_matrix", "jtbd", "disruption_lens"],
  white_space: ["blue_ocean", "jtbd", "three_horizons"],
  geographic: ["ansoff_matrix", "porter_five_forces"],
  m_and_a: ["bcg_matrix", "porter_five_forces"],
  pricing: ["porter_five_forces", "blue_ocean"],
  capability: ["wardley_map", "three_horizons"],
  competitive_response: ["porter_five_forces", "disruption_lens", "jtbd"],
  portfolio: ["bcg_matrix", "three_horizons"],
  scenario: ["three_horizons", "wardley_map"],
  custom: ["porter_five_forces", "jtbd"],
};

/** Resolve the frameworks to apply for a question type. Pure — exported for tests. */
export function frameworksForQuestionType(type: QuestionType): FrameworkDef[] {
  const ids = FRAMEWORKS_BY_TYPE[type] ?? FRAMEWORKS_BY_TYPE.custom;
  return FRAMEWORKS.filter((f) => ids.includes(f.id));
}

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface FrameworkSection {
  title: string;
  points: string[];
}

export interface FrameworkAnalysis {
  frameworkId: string;
  frameworkLabel: string;
  sections: FrameworkSection[];
  summary: string;
  keyImplications: string[];
}

const MAX_SECTIONS = 8;
const MAX_POINTS = 8;
const MAX_IMPLICATIONS = 8;

// ─────────────────────────────────────────────────────────────────────────────
// LLM SCHEMA + PARSING
// ─────────────────────────────────────────────────────────────────────────────

const ANALYSIS_SCHEMA = {
  name: "framework_analysis",
  strict: false,
  schema: {
    type: "object",
    properties: {
      sections: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            points: { type: "array", items: { type: "string" } },
          },
          required: ["title", "points"],
        },
      },
      summary: { type: "string" },
      keyImplications: { type: "array", items: { type: "string" } },
    },
    required: ["sections", "summary"],
  },
} as const;

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" && v.trim() ? v.trim() : fallback;
}

function asStringList(v: unknown, cap: number): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const item of v) {
    const s = asString(item);
    if (s) out.push(s);
    if (out.length >= cap) break;
  }
  return out;
}

/** Normalise raw LLM output into a FrameworkAnalysis. Exported for tests. */
export function normalizeFrameworkAnalysis(
  raw: unknown,
  framework: FrameworkDef,
): FrameworkAnalysis {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;

  const sections: FrameworkSection[] = [];
  if (Array.isArray(o.sections)) {
    for (const s of o.sections) {
      if (!s || typeof s !== "object") continue;
      const so = s as Record<string, unknown>;
      const title = asString(so.title);
      if (!title) continue;
      sections.push({ title, points: asStringList(so.points, MAX_POINTS) });
      if (sections.length >= MAX_SECTIONS) break;
    }
  }

  return {
    frameworkId: framework.id,
    frameworkLabel: framework.label,
    sections,
    summary: asString(o.summary),
    keyImplications: asStringList(o.keyImplications, MAX_IMPLICATIONS),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// APPLY ONE FRAMEWORK
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Apply one framework to a question, grounded in the supplied company memory.
 * Best-effort — returns an empty analysis on failure.
 */
export async function applyFramework(
  framework: FrameworkDef,
  question: string,
  memoryContext: string,
  ctx: RouterContext,
): Promise<FrameworkAnalysis> {
  const system =
    `You are a strategy analyst applying ${framework.label} — ${framework.focus}. ` +
    `Structure the analysis as sections: ${framework.sectionsHint}. Be specific and ` +
    `decision-relevant; ground every point in the company context where available. ` +
    `End with a summary and the key strategic implications.`;

  const user =
    `Question:\n${question}\n\n` +
    (memoryContext
      ? `What the platform knows about this company:\n${memoryContext}`
      : "No company memory is available — note where that limits the analysis.");

  try {
    const result = await router.structured<Record<string, unknown>>({
      task: "worker",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      schema: ANALYSIS_SCHEMA as unknown as {
        name: string;
        strict?: boolean;
        schema: Record<string, unknown>;
      },
      ctx,
    });
    return normalizeFrameworkAnalysis(result.data, framework);
  } catch {
    return {
      frameworkId: framework.id,
      frameworkLabel: framework.label,
      sections: [],
      summary: `${framework.label} analysis could not be completed.`,
      keyImplications: [],
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// RUN THE FRAMEWORK SET
// ─────────────────────────────────────────────────────────────────────────────

export interface FrameworkRunResult {
  question: string;
  analyses: FrameworkAnalysis[];
}

/**
 * Apply the frameworks selected for a question type, in parallel, grounded in
 * the company's memory.
 */
export async function runFrameworks(
  question: string,
  questionType: QuestionType,
  companyId: number,
  ctx: RouterContext,
): Promise<FrameworkRunResult> {
  const frameworks = frameworksForQuestionType(questionType);

  let memoryContext = "";
  try {
    const memories = await hybridSearchMemory({
      tenantId: ctx.tenantId,
      companyId,
      query: question,
      limit: 15,
      ctx: { ...ctx, companyId },
    });
    memoryContext = memories.map((m, i) => `${i + 1}. ${m.canonicalForm}`).join("\n");
  } catch {
    memoryContext = "";
  }

  const analyses = await Promise.all(
    frameworks.map((f) => applyFramework(f, question, memoryContext, ctx)),
  );

  return { question, analyses };
}
