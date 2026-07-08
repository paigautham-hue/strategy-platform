/**
 * Pre-Mortem Launch Ritual — IMPLEMENTATION_PLAN.md Phase 5, Workstream 5.1
 *
 * Before an initiative is allowed to go "active", it runs a pre-mortem: assume
 * it is twelve months later and the initiative has failed outright — then work
 * backwards to explain why. The ritual produces a risk register, each risk
 * graded for likelihood and impact, with an early-warning sign and a
 * mitigation. A pre-mortem with no risks is itself a red flag.
 *
 * Stateless reasoning — gating an initiative's lifecycle state on a completed
 * pre-mortem is Workstream 5.2 (initiative records, connector-gated).
 */

import * as router from "../ai/router";
import type { RouterContext } from "../ai/router";
import { hybridSearchMemory } from "../services/memory-search";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type RiskGrade = "low" | "medium" | "high";

export interface PreMortemRisk {
  risk: string;
  likelihood: RiskGrade;
  impact: RiskGrade;
  /** The signal that this risk is starting to materialise. */
  earlyWarningSign: string;
  mitigation: string;
  /** Derived: likelihood × impact, "low" | "medium" | "high" | "critical". */
  severity: "low" | "medium" | "high" | "critical";
}

export interface PreMortemResult {
  initiative: string;
  risks: PreMortemRisk[];
  /** The single risk most worth pre-empting. */
  topRisk: string;
  /** Is the pre-mortem strong enough to clear the initiative for launch? */
  readyToLaunch: boolean;
}

const MAX_RISKS = 10;
const GRADES: readonly RiskGrade[] = ["low", "medium", "high"];
const GRADE_SCORE: Record<RiskGrade, number> = { low: 1, medium: 2, high: 3 };

// ─────────────────────────────────────────────────────────────────────────────
// SCHEMA
// ─────────────────────────────────────────────────────────────────────────────

const PRE_MORTEM_SCHEMA = {
  name: "pre_mortem",
  strict: false,
  schema: {
    type: "object",
    properties: {
      risks: {
        type: "array",
        items: {
          type: "object",
          properties: {
            risk: { type: "string", description: "What went wrong." },
            likelihood: { type: "string", enum: ["low", "medium", "high"] },
            impact: { type: "string", enum: ["low", "medium", "high"] },
            earlyWarningSign: { type: "string", description: "The signal this risk is materialising." },
            mitigation: { type: "string", description: "How to pre-empt or contain it." },
          },
          required: ["risk", "likelihood", "impact"],
        },
      },
      topRisk: { type: "string", description: "The single risk most worth pre-empting." },
    },
    required: ["risks", "topRisk"],
  },
} as const;

const SYSTEM_INSTRUCTION =
  "You run a pre-mortem. Assume it is twelve months from now and the " +
  "initiative has failed outright. Work backwards: name the specific reasons " +
  "it failed. For each, grade likelihood and impact (low/medium/high), give " +
  "the early-warning sign that it is starting to materialise, and a concrete " +
  "mitigation. Be unsparing — a comfortable pre-mortem is a useless one. " +
  "Then name the single risk most worth pre-empting.";

// ─────────────────────────────────────────────────────────────────────────────
// DEFENSIVE PARSING
// ─────────────────────────────────────────────────────────────────────────────

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" && v.trim() ? v.trim() : fallback;
}

function asGrade(v: unknown): RiskGrade {
  const s = asString(v).toLowerCase();
  return (GRADES as readonly string[]).includes(s) ? (s as RiskGrade) : "medium";
}

/** Combine likelihood × impact into a severity band. Pure — exported for tests. */
export function riskSeverity(
  likelihood: RiskGrade,
  impact: RiskGrade,
): PreMortemRisk["severity"] {
  const score = GRADE_SCORE[likelihood] * GRADE_SCORE[impact];
  if (score >= 9) return "critical";
  if (score >= 6) return "high";
  if (score >= 3) return "medium";
  return "low";
}

/** Normalise raw LLM output into a PreMortemResult. Exported for tests. */
export function normalizePreMortem(raw: unknown, initiative: string): PreMortemResult {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;

  const risks: PreMortemRisk[] = [];
  if (Array.isArray(o.risks)) {
    for (const item of o.risks) {
      if (!item || typeof item !== "object") continue;
      const r = item as Record<string, unknown>;
      const risk = asString(r.risk);
      if (!risk) continue;
      const likelihood = asGrade(r.likelihood);
      const impact = asGrade(r.impact);
      risks.push({
        risk,
        likelihood,
        impact,
        earlyWarningSign: asString(r.earlyWarningSign),
        mitigation: asString(r.mitigation),
        severity: riskSeverity(likelihood, impact),
      });
      if (risks.length >= MAX_RISKS) break;
    }
  }

  // Sort most-severe first so the register reads worst-to-least.
  const order: Record<PreMortemRisk["severity"], number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };
  risks.sort((a, b) => order[a.severity] - order[b.severity]);

  // A pre-mortem only clears an initiative when it actually surfaced risks and
  // every risk it surfaced carries a mitigation (Phase 5 launch gate).
  const readyToLaunch =
    risks.length > 0 && risks.every((r) => r.mitigation.length > 0);

  return {
    initiative,
    risks,
    topRisk: asString(o.topRisk, risks[0]?.risk ?? "No top risk was identified."),
    readyToLaunch,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// RITUAL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run a pre-mortem for an initiative, grounded in company memory. Best-effort —
 * returns an empty register (and readyToLaunch false) on failure.
 */
export async function runPreMortem(
  initiative: string,
  context: string,
  companyId: number,
  ctx: RouterContext,
): Promise<PreMortemResult> {
  let memoryContext = "";
  try {
    const memories = await hybridSearchMemory({
      tenantId: ctx.tenantId,
      companyId,
      query: `${initiative} ${context}`.trim(),
      limit: 12,
      ctx: { ...ctx, companyId },
    });
    memoryContext = memories.map((m, i) => `${i + 1}. ${m.canonicalForm}`).join("\n");
  } catch {
    memoryContext = "";
  }

  const user =
    `INITIATIVE:\n${initiative}\n\n` +
    (context ? `Context:\n${context}\n\n` : "") +
    (memoryContext ? `What the platform knows about the company:\n${memoryContext}` : "No company memory is available.");

  try {
    const result = await router.structured<Record<string, unknown>>({
      task: "planner",
      messages: [
        { role: "system", content: SYSTEM_INSTRUCTION },
        { role: "user", content: user },
      ],
      schema: PRE_MORTEM_SCHEMA as unknown as {
        name: string;
        strict?: boolean;
        schema: Record<string, unknown>;
      },
      ctx,
    });
    return normalizePreMortem(result.data, initiative);
  } catch {
    return { initiative, risks: [], topRisk: "The pre-mortem could not complete.", readyToLaunch: false };
  }
}
