/**
 * Strategic Item Extraction Agent — structured-output auto-write (salvaged from StrategyForge)
 * IMPLEMENTATION_PLAN.md Phase 5
 *
 * Generates KPIs / milestones / risks for a strategy as JSON-schema-constrained
 * output (C3, via the router), then hands them to the pure normalisers in
 * `server/services/strategy-management.ts` so they can be written straight into
 * the strategy project's data model. Best-effort: on failure returns empty sets.
 */

import * as router from "../ai/router";
import type { RouterContext } from "../ai/router";
import { normalizeStrategicItems, type NormalizedStrategicItems } from "../services/strategy-management";

const STRATEGIC_ITEMS_SCHEMA = {
  name: "strategic_items",
  strict: false,
  schema: {
    type: "object",
    properties: {
      kpis: {
        type: "array",
        items: {
          type: "object",
          properties: {
            label: { type: "string" },
            target: { type: "number", description: "Numeric target value, if known." },
            current: { type: "number", description: "Current value, if known." },
            unit: { type: "string", description: "e.g. %, ₹ Cr, months, ratio." },
            category: {
              type: "string",
              description: "operational | market | financial | organizational (free text is mapped).",
            },
            status: { type: "string", description: "on-track | at-risk | off-track | unknown." },
          },
          required: ["label"],
        },
      },
      milestones: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            quarter: { type: "string", description: "e.g. Q2." },
            fiscalYear: { type: "string", description: "e.g. FY25-26." },
            status: { type: "string", description: "planned | in-progress | done | missed." },
          },
          required: ["title"],
        },
      },
      risks: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            probability: { type: "number", description: "0–100." },
            impact: { type: "number", description: "0–100." },
            mitigation: { type: "string" },
          },
          required: ["title"],
        },
      },
    },
    required: ["kpis", "milestones", "risks"],
  },
} as const;

const SYSTEM_INSTRUCTION =
  "You are a strategy operator. From the strategy context provided, extract a " +
  "concrete, trackable set of KPIs (with target/current/unit where inferable), " +
  "roadmap milestones (with quarter/fiscal year), and risks (with probability " +
  "and impact on a 0–100 scale, plus a mitigation). Be specific to the context — " +
  "no generic placeholders. Return only items that are genuinely supported.";

/**
 * Generate and normalise trackable strategic items from a strategy context.
 * Best-effort: on LLM failure returns empty sets (never throws).
 */
export async function extractStrategicItems(
  context: string,
  ctx: RouterContext,
): Promise<NormalizedStrategicItems> {
  const trimmed = context.trim();
  if (!trimmed) return { kpis: [], milestones: [], risks: [] };

  try {
    const result = await router.structured<Record<string, unknown>>({
      task: "extraction",
      messages: [
        { role: "system", content: SYSTEM_INSTRUCTION },
        { role: "user", content: trimmed },
      ],
      schema: STRATEGIC_ITEMS_SCHEMA as unknown as { name: string; strict?: boolean; schema: Record<string, unknown> },
      ctx,
    });
    return normalizeStrategicItems(result.data);
  } catch {
    return { kpis: [], milestones: [], risks: [] };
  }
}
