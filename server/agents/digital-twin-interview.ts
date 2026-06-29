/**
 * Digital Twin Interview Agent — salvaged from Dynamo
 * IMPLEMENTATION_PLAN.md Phase 1 (conversational intake) + Phase 2 (strategy synthesis)
 *
 * The LLM-facing half of the Digital Twin engine. The pure scoring/steering core
 * lives in `server/services/digital-twin.ts`; this module turns it into:
 *   1. `nextDiscoveryTurn` — the next consultant message, with the under-explored
 *      dimension steered into the system prompt (the salvaged "Internal Note").
 *   2. `generateAiStrategy` — a JSON-schema-constrained AI-transformation strategy
 *      from the assembled Digital Twin.
 *
 * Both route through the LLM router (C3) — never a provider SDK or a hardwired
 * proxy (the donor hardwired a single Gemini endpoint). Both are best-effort:
 * on LLM failure they degrade rather than throw.
 */

import * as router from "../ai/router";
import type { RouterContext } from "../ai/router";
import {
  type ConversationMessage,
  type Dimension,
  type DimensionCoverage,
  type CompletenessGates,
  DIMENSION_KEYS,
  DIMENSIONS,
  DISCOVERY_SYSTEM_PROMPT,
  buildSteeringNote,
  scoreDimensionCoverage,
  completenessGates,
  underexploredDimensions,
} from "../services/digital-twin";

// ─────────────────────────────────────────────────────────────────────────────
// DISCOVERY TURN
// ─────────────────────────────────────────────────────────────────────────────

export interface DiscoveryTurn {
  /** The consultant's next message. */
  reply: string;
  /** Per-dimension coverage after this user message. */
  coverage: DimensionCoverage;
  /** Funnel gates (preview / full-strategy availability). */
  gates: CompletenessGates;
  /** The dimension the model was steered toward, if any. */
  suggestedFocus: Dimension | null;
}

const FALLBACK_REPLY =
  "Thanks — that's helpful. Could you tell me a bit more about how your business " +
  "makes money and who your main customers are?";

/**
 * Produce the next discovery message. The under-explored dimension is steered
 * into the system prompt; coverage and gates are recomputed from the full
 * conversation (including `userMessage`). Best-effort.
 */
export async function nextDiscoveryTurn(
  history: ConversationMessage[],
  userMessage: string,
  ctx: RouterContext,
): Promise<DiscoveryTurn> {
  const allMessages: ConversationMessage[] = [...history, { role: "user", content: userMessage }];
  const coverage = scoreDimensionCoverage(allMessages);
  const gates = completenessGates(coverage);
  const unexplored = underexploredDimensions(coverage);
  const suggestedFocus = unexplored[0] ?? null;

  const systemPrompt = DISCOVERY_SYSTEM_PROMPT + buildSteeringNote(coverage);

  try {
    const result = await router.complete({
      systemPrompt,
      messages: allMessages.map((m) => ({ role: m.role, content: m.content })),
      ctx,
    });
    const reply = result.content.trim() || FALLBACK_REPLY;
    return { reply, coverage, gates, suggestedFocus };
  } catch {
    return { reply: FALLBACK_REPLY, coverage, gates, suggestedFocus };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// STRATEGY GENERATION
// ─────────────────────────────────────────────────────────────────────────────

export interface StrategyOpportunity {
  title: string;
  description: string;
  impact: string;
  feasibility: string;
}
export interface StrategyUseCase {
  title: string;
  description: string;
  roiPotential: string;
  timeline: string;
}
export interface StrategyRisk {
  risk: string;
  mitigation: string;
}
export interface AiStrategy {
  aiReadinessScore: number;
  executiveSummary: string;
  opportunities: StrategyOpportunity[];
  useCases: StrategyUseCase[];
  risks: StrategyRisk[];
}

/** Per-dimension free-text summary of the assembled Digital Twin. */
export type DigitalTwinSummary = Partial<Record<Dimension, string>>;

const STRATEGY_SCHEMA = {
  name: "ai_transformation_strategy",
  strict: false,
  schema: {
    type: "object",
    properties: {
      aiReadinessScore: { type: "number", description: "0–100 overall AI readiness." },
      executiveSummary: { type: "string", description: "3–4 sentence executive summary." },
      opportunities: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            impact: { type: "string", description: "Business impact, e.g. high/medium/low + why." },
            feasibility: { type: "string", description: "Feasibility, e.g. high/medium/low + why." },
          },
          required: ["title", "description"],
        },
      },
      useCases: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            roiPotential: { type: "string" },
            timeline: { type: "string" },
          },
          required: ["title", "description"],
        },
      },
      risks: {
        type: "array",
        items: {
          type: "object",
          properties: {
            risk: { type: "string" },
            mitigation: { type: "string" },
          },
          required: ["risk", "mitigation"],
        },
      },
    },
    required: ["aiReadinessScore", "executiveSummary", "opportunities", "useCases", "risks"],
  },
} as const;

const STRATEGY_SYSTEM_INSTRUCTION =
  "You are an elite AI-transformation strategy consultant. From the structured " +
  "business understanding (the company's Digital Twin), produce a grounded, " +
  "specific AI-transformation strategy: an overall AI-readiness score (0–100), a " +
  "tight executive summary, concrete opportunities (with impact + feasibility), " +
  "high-ROI use cases (with timeline), and the key risks with mitigations. Be " +
  "specific to this company — no generic boilerplate.";

const MAX_ITEMS = 8;

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" && v.trim() ? v.trim() : fallback;
}

function clampScore(v: unknown): number {
  const n = typeof v === "number" && Number.isFinite(v) ? v : 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function asArray(v: unknown): Record<string, unknown>[] {
  return Array.isArray(v) ? (v.filter((x) => x && typeof x === "object") as Record<string, unknown>[]).slice(0, MAX_ITEMS) : [];
}

/** Normalise raw LLM output into an AiStrategy. Exported for unit testing. Pure. */
export function normalizeStrategy(raw: unknown): AiStrategy {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    aiReadinessScore: clampScore(o.aiReadinessScore),
    executiveSummary: asString(o.executiveSummary),
    opportunities: asArray(o.opportunities).map((x) => ({
      title: asString(x.title),
      description: asString(x.description),
      impact: asString(x.impact),
      feasibility: asString(x.feasibility),
    })),
    useCases: asArray(o.useCases).map((x) => ({
      title: asString(x.title),
      description: asString(x.description),
      roiPotential: asString(x.roiPotential),
      timeline: asString(x.timeline),
    })),
    risks: asArray(o.risks).map((x) => ({
      risk: asString(x.risk),
      mitigation: asString(x.mitigation),
    })),
  };
}

/** Render the Digital Twin summary into the prompt body. Pure. */
export function renderTwinForPrompt(twin: DigitalTwinSummary, companyName?: string): string {
  const header = companyName ? `Company: ${companyName}\n\n` : "";
  const body = DIMENSION_KEYS.map((d) => `${DIMENSIONS[d]}: ${asString(twin[d], "(not yet captured)")}`).join("\n");
  return `${header}Digital Twin:\n${body}`;
}

/**
 * Generate an AI-transformation strategy from the assembled Digital Twin.
 * Best-effort: on LLM failure returns an empty (zeroed) strategy.
 */
export async function generateAiStrategy(
  twin: DigitalTwinSummary,
  ctx: RouterContext,
  companyName?: string,
): Promise<AiStrategy> {
  try {
    const result = await router.structured<Record<string, unknown>>({
      messages: [
        { role: "system", content: STRATEGY_SYSTEM_INSTRUCTION },
        { role: "user", content: renderTwinForPrompt(twin, companyName) },
      ],
      schema: STRATEGY_SCHEMA as unknown as { name: string; strict?: boolean; schema: Record<string, unknown> },
      ctx,
    });
    return normalizeStrategy(result.data);
  } catch {
    return normalizeStrategy({});
  }
}
