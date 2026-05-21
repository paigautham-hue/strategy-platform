/**
 * Share-and-Apply Engine — IMPLEMENTATION_PLAN.md Phase 2, Workstream 2.8
 * Heuristic H13 — external strategies are first-class inputs
 *
 * Phase 1 (Workstream 1.8) recognises an external strategy artifact. This is
 * the application step: take that structured artifact and apply it to a
 * specific portfolio company —
 *
 *   - Fit assessment: score the artifact's preconditions and moves against
 *     what the platform knows about the company → a fit score + gap list
 *   - Adaptation: rewrite each key move for the company's actual context
 *   - Application memo: a briefing-default (H6) recommendation
 *
 * Grounded in company memory (hybrid search). One structured LLM call (C3)
 * with defensive parsing.
 */

import * as router from "../ai/router";
import type { RouterContext } from "../ai/router";
import { hybridSearchMemory } from "../services/memory-search";
import type { StrategyArtifact } from "../services/strategy-artifact";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface AdaptedMove {
  /** The move as the original artifact states it. */
  original: string;
  /** The move rewritten for this company's actual context. */
  adapted: string;
}

export interface StrategyApplication {
  /** 0–100 — how well the artifact fits this company. */
  fitScore: number;
  /** Why the fit score is what it is. */
  fitRationale: string;
  /** Preconditions or capabilities the company lacks for this strategy. */
  gaps: string[];
  /** The artifact's moves, rewritten for this company. */
  adaptedMoves: AdaptedMove[];
  /** Risks of applying this strategy here. */
  risks: string[];
  /** pursue / adapt-heavily / skip — with the reason. */
  recommendation: string;
  /** A 1-page application memo (briefing-default, H6). */
  applicationMemo: string;
}

const MAX_LIST = 12;

// ─────────────────────────────────────────────────────────────────────────────
// LLM SCHEMA
// ─────────────────────────────────────────────────────────────────────────────

const APPLICATION_SCHEMA = {
  name: "strategy_application",
  strict: false,
  schema: {
    type: "object",
    properties: {
      fitScore: { type: "number", description: "0-100 — how well the strategy fits this company." },
      fitRationale: { type: "string" },
      gaps: {
        type: "array",
        items: { type: "string" },
        description: "Preconditions or capabilities the company lacks.",
      },
      adaptedMoves: {
        type: "array",
        items: {
          type: "object",
          properties: {
            original: { type: "string" },
            adapted: { type: "string" },
          },
          required: ["original", "adapted"],
        },
      },
      risks: { type: "array", items: { type: "string" } },
      recommendation: {
        type: "string",
        description: "pursue / adapt-heavily / skip — with a one-line reason.",
      },
      applicationMemo: {
        type: "string",
        description: "A concise one-page memo: the recommendation, the fit, the adapted plan, the risks.",
      },
    },
    required: ["fitScore", "fitRationale", "recommendation", "applicationMemo"],
  },
} as const;

const SYSTEM_INSTRUCTION =
  "You apply an external strategy artifact to a specific portfolio company. " +
  "Assess honestly how well it fits: score the preconditions and moves against " +
  "what is known about the company. Name the real gaps. Rewrite each key move " +
  "for the company's actual context. Surface the risks. Give a clear " +
  "recommendation (pursue / adapt-heavily / skip) and a concise application " +
  "memo. Do not flatter the fit — a low score with clear reasons is valuable.";

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

function asScore(v: unknown): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return 0;
  if (v < 0) return 0;
  if (v > 100) return 100;
  return Math.round(v);
}

function asAdaptedMoves(v: unknown): AdaptedMove[] {
  if (!Array.isArray(v)) return [];
  const out: AdaptedMove[] = [];
  for (const item of v) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const original = asString(o.original);
    const adapted = asString(o.adapted);
    if (original || adapted) out.push({ original, adapted: adapted || original });
    if (out.length >= MAX_LIST) break;
  }
  return out;
}

/** Normalise raw LLM output into a StrategyApplication. Exported for tests. */
export function normalizeApplication(raw: unknown): StrategyApplication {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    fitScore: asScore(o.fitScore),
    fitRationale: asString(o.fitRationale),
    gaps: asStringList(o.gaps),
    adaptedMoves: asAdaptedMoves(o.adaptedMoves),
    risks: asStringList(o.risks),
    recommendation: asString(o.recommendation, "No recommendation produced."),
    applicationMemo: asString(o.applicationMemo),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// APPLICATION
// ─────────────────────────────────────────────────────────────────────────────

/** Render a StrategyArtifact into a compact prompt block. */
function renderArtifact(a: StrategyArtifact): string {
  const lines = [
    `Title: ${a.title}`,
    `Type: ${a.artifactType ?? "unspecified"}`,
    `Core thesis: ${a.coreThesis}`,
  ];
  if (a.preconditions.length) lines.push(`Preconditions:\n${a.preconditions.map((p) => `- ${p}`).join("\n")}`);
  if (a.keyMoves.length) lines.push(`Key moves:\n${a.keyMoves.map((m) => `- ${m}`).join("\n")}`);
  if (a.expectedOutcomes.length)
    lines.push(`Expected outcomes:\n${a.expectedOutcomes.map((o) => `- ${o}`).join("\n")}`);
  if (a.contextOfOrigin) lines.push(`Context of origin: ${a.contextOfOrigin}`);
  return lines.join("\n");
}

/**
 * Apply a recognised strategy artifact to a company. Grounds the assessment
 * in the company's memory. Best-effort — returns a low-fit result on failure.
 */
export async function applyStrategyToCompany(
  artifact: StrategyArtifact,
  companyId: number,
  ctx: RouterContext,
): Promise<StrategyApplication> {
  if (!artifact.isStrategyArtifact) {
    return {
      fitScore: 0,
      fitRationale: "The provided text was not recognised as a strategy artifact.",
      gaps: [],
      adaptedMoves: [],
      risks: [],
      recommendation: "skip — not a strategy artifact",
      applicationMemo: "",
    };
  }

  // Ground in company memory.
  let memoryContext = "";
  try {
    const memories = await hybridSearchMemory({
      tenantId: ctx.tenantId,
      companyId,
      query: `${artifact.title} ${artifact.coreThesis}`,
      limit: 15,
      ctx: { ...ctx, companyId },
    });
    memoryContext = memories.map((m, i) => `${i + 1}. ${m.canonicalForm}`).join("\n");
  } catch {
    memoryContext = "";
  }

  const user =
    `STRATEGY ARTIFACT:\n${renderArtifact(artifact)}\n\n` +
    `TARGET COMPANY — what the platform knows:\n` +
    (memoryContext || "No company memory is available — note this limits the fit assessment.");

  try {
    const result = await router.structured<Record<string, unknown>>({
      messages: [
        { role: "system", content: SYSTEM_INSTRUCTION },
        { role: "user", content: user },
      ],
      schema: APPLICATION_SCHEMA as unknown as {
        name: string;
        strict?: boolean;
        schema: Record<string, unknown>;
      },
      ctx,
    });
    return normalizeApplication(result.data);
  } catch {
    return {
      fitScore: 0,
      fitRationale: "The application engine could not complete.",
      gaps: [],
      adaptedMoves: [],
      risks: [],
      recommendation: "retry — application failed",
      applicationMemo: "",
    };
  }
}
