/**
 * Chief Strategist + Research Mesh — IMPLEMENTATION_PLAN.md Phase 2, 2.1 + 2.3
 *
 * The Chief Strategist takes a diagnosed question and dispatches a mesh of
 * specialist research agents in parallel, each examining the question through
 * one lens. Every agent is grounded in the company's own memory (hybrid
 * search) so findings cite what the platform already knows, not just the
 * model's priors. Findings are then synthesised into one research brief.
 *
 * Hierarchical orchestration (H4): the Chief Strategist dispatches; each
 * specialist returns a structured result; specialists never call each other.
 * Budgets are enforced per call by the LLM router.
 */

import * as router from "../ai/router";
import type { RouterContext } from "../ai/router";
import { hybridSearchMemory } from "../services/memory-search";
import type { QuestionType } from "./diagnosis";

// ─────────────────────────────────────────────────────────────────────────────
// SPECIALISTS
// ─────────────────────────────────────────────────────────────────────────────

export interface ResearchSpecialist {
  id: string;
  label: string;
  /** What this specialist examines. */
  lens: string;
}

export const RESEARCH_SPECIALISTS: readonly ResearchSpecialist[] = [
  { id: "market", label: "Market Researcher", lens: "market size, growth rate, structure, and dynamics" },
  { id: "competitor", label: "Competitor Analyst", lens: "competitors — their positioning, moves, strengths, and weaknesses" },
  { id: "customer", label: "Customer Researcher", lens: "customer segments, jobs-to-be-done, unmet needs, and sentiment" },
  { id: "tech", label: "Technology Scout", lens: "technology trends, S-curves, and disruption threats or enablers" },
  { id: "regulatory", label: "Regulatory Analyst", lens: "regulation, compliance burden, and policy risk" },
  { id: "macro", label: "Macro Analyst", lens: "macroeconomic forces — rates, FX, labour, geopolitics" },
  { id: "talent", label: "Talent Analyst", lens: "talent supply, capability gaps, hiring, and organisational readiness" },
  { id: "internal", label: "Internal-Data Analyst", lens: "the firm's own position — capabilities, performance, and prior decisions" },
] as const;

/**
 * Which specialists are most relevant to a question type. The internal-data
 * analyst always runs (every question is grounded in the firm itself).
 */
const SPECIALISTS_BY_TYPE: Record<QuestionType, string[]> = {
  adjacency: ["internal", "market", "customer", "competitor", "tech"],
  white_space: ["internal", "customer", "market", "competitor", "tech"],
  geographic: ["internal", "market", "regulatory", "macro", "competitor"],
  m_and_a: ["internal", "competitor", "market", "macro", "talent"],
  pricing: ["internal", "customer", "competitor", "market"],
  capability: ["internal", "talent", "tech", "competitor"],
  competitive_response: ["internal", "competitor", "customer", "market", "tech"],
  portfolio: ["internal", "market", "macro", "competitor"],
  scenario: ["internal", "macro", "tech", "regulatory", "market"],
  custom: ["internal", "market", "competitor", "customer"],
};

/** Resolve the specialists to run for a question type. Pure — exported for tests. */
export function specialistsForQuestionType(type: QuestionType): ResearchSpecialist[] {
  const ids = SPECIALISTS_BY_TYPE[type] ?? SPECIALISTS_BY_TYPE.custom;
  return RESEARCH_SPECIALISTS.filter((s) => ids.includes(s.id));
}

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface SpecialistFindings {
  specialistId: string;
  specialistLabel: string;
  findings: string[];
  summary: string;
  confidence: "high" | "medium" | "low";
}

export interface ResearchBrief {
  question: string;
  specialists: SpecialistFindings[];
  synthesis: string;
  keyTakeaways: string[];
}

const CONFIDENCE_VALUES = ["high", "medium", "low"] as const;
const MAX_FINDINGS = 8;
const MAX_TAKEAWAYS = 8;

// ─────────────────────────────────────────────────────────────────────────────
// ONE RESEARCH AGENT
// ─────────────────────────────────────────────────────────────────────────────

const FINDINGS_SCHEMA = {
  name: "research_findings",
  strict: false,
  schema: {
    type: "object",
    properties: {
      findings: {
        type: "array",
        items: { type: "string" },
        description: "Specific, decision-relevant findings through this specialist's lens.",
      },
      summary: { type: "string", description: "One-paragraph summary of what was found." },
      confidence: { type: "string", enum: ["high", "medium", "low"] },
    },
    required: ["findings", "summary", "confidence"],
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

/**
 * Run one research specialist against the question, grounded in the supplied
 * company-memory context. Best-effort: returns a low-confidence empty result
 * on failure so one agent never aborts the mesh.
 */
export async function runResearchAgent(
  specialist: ResearchSpecialist,
  question: string,
  memoryContext: string,
  ctx: RouterContext,
): Promise<SpecialistFindings> {
  const system =
    `You are the ${specialist.label} on a strategy research team. Examine the ` +
    `question strictly through your lens: ${specialist.lens}. Produce specific, ` +
    `decision-relevant findings — not generalities. Where the company's own ` +
    `memory is provided, ground your findings in it and note gaps.`;

  const user =
    `Strategic question:\n${question}\n\n` +
    (memoryContext
      ? `What the platform already knows about this company:\n${memoryContext}`
      : "No company memory is available yet — note this as a research gap.");

  try {
    const result = await router.structured<Record<string, unknown>>({
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      schema: FINDINGS_SCHEMA as unknown as {
        name: string;
        strict?: boolean;
        schema: Record<string, unknown>;
      },
      ctx,
    });
    const o = result.data;
    const confStr = asString(o.confidence);
    return {
      specialistId: specialist.id,
      specialistLabel: specialist.label,
      findings: asStringList(o.findings, MAX_FINDINGS),
      summary: asString(o.summary),
      confidence: (CONFIDENCE_VALUES as readonly string[]).includes(confStr)
        ? (confStr as SpecialistFindings["confidence"])
        : "low",
    };
  } catch {
    return {
      specialistId: specialist.id,
      specialistLabel: specialist.label,
      findings: [],
      summary: "This research agent could not complete.",
      confidence: "low",
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CHIEF STRATEGIST — ORCHESTRATION
// ─────────────────────────────────────────────────────────────────────────────

const SYNTHESIS_SCHEMA = {
  name: "research_synthesis",
  strict: false,
  schema: {
    type: "object",
    properties: {
      synthesis: {
        type: "string",
        description: "A synthesis of the specialist findings into a coherent research picture.",
      },
      keyTakeaways: {
        type: "array",
        items: { type: "string" },
        description: "The decisions-relevant takeaways a strategist must act on.",
      },
    },
    required: ["synthesis", "keyTakeaways"],
  },
} as const;

/**
 * Run the research mesh for a diagnosed question.
 *
 * @param question     the (reframed) strategic question
 * @param questionType the diagnosed type — selects which specialists run
 * @param companyId    the portco whose memory grounds the research
 */
export async function runResearchMesh(
  question: string,
  questionType: QuestionType,
  companyId: number,
  ctx: RouterContext,
): Promise<ResearchBrief> {
  const specialists = specialistsForQuestionType(questionType);

  // Ground the mesh once: pull the company's memory relevant to the question.
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

  // Dispatch all specialists in parallel (H4).
  const specialistResults = await Promise.all(
    specialists.map((s) => runResearchAgent(s, question, memoryContext, ctx)),
  );

  // Synthesise.
  const synthesis = await synthesizeFindings(question, specialistResults, ctx);

  return {
    question,
    specialists: specialistResults,
    synthesis: synthesis.synthesis,
    keyTakeaways: synthesis.keyTakeaways,
  };
}

/** Combine specialist findings into a synthesis. Best-effort. */
async function synthesizeFindings(
  question: string,
  results: SpecialistFindings[],
  ctx: RouterContext,
): Promise<{ synthesis: string; keyTakeaways: string[] }> {
  const body = results
    .map(
      (r) =>
        `## ${r.specialistLabel} (confidence: ${r.confidence})\n${r.summary}\n` +
        r.findings.map((f) => `- ${f}`).join("\n"),
    )
    .join("\n\n");

  try {
    const result = await router.structured<Record<string, unknown>>({
      messages: [
        {
          role: "system",
          content:
            "You are the Chief Strategist. Synthesise the research team's specialist " +
            "findings into one coherent picture and the decision-relevant takeaways.",
        },
        { role: "user", content: `Question:\n${question}\n\nSpecialist findings:\n${body}` },
      ],
      schema: SYNTHESIS_SCHEMA as unknown as {
        name: string;
        strict?: boolean;
        schema: Record<string, unknown>;
      },
      ctx,
    });
    return {
      synthesis: asString(result.data.synthesis),
      keyTakeaways: asStringList(result.data.keyTakeaways, MAX_TAKEAWAYS),
    };
  } catch {
    return { synthesis: "Synthesis could not be completed.", keyTakeaways: [] };
  }
}
