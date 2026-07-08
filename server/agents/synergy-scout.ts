/**
 * Synergy Scout — IMPLEMENTATION_PLAN.md Phase 7, Workstream 7.1
 *
 * Across a portfolio, value hides in the overlaps. The Synergy Scout runs nine
 * detectors over two or more portfolio companies and surfaces the concrete
 * synergy candidates — shared customers, joint procurement leverage,
 * licensable IP, correlated macro risk, and so on.
 *
 * Like the cross-company war-game, this is a deliberate cross-company read
 * (C1): GP-only, every company's memory search namespaced to that one
 * company, and every cross-company read audit-logged by the caller.
 */

import * as router from "../ai/router";
import type { RouterContext } from "../ai/router";
import { hybridSearchMemory } from "../services/memory-search";

// ─────────────────────────────────────────────────────────────────────────────
// DETECTORS
// ─────────────────────────────────────────────────────────────────────────────

export interface SynergyDetector {
  id: string;
  label: string;
  /** The signal this detector looks for. */
  signal: string;
}

export const SYNERGY_DETECTORS: readonly SynergyDetector[] = [
  { id: "capability_overlap", label: "Capability overlap", signal: "Skill, IP, or tech complementarity." },
  { id: "customer_overlap", label: "Customer overlap", signal: "Named accounts or ICP overlap." },
  { id: "supplier_overlap", label: "Supplier overlap", signal: "Joint procurement leverage." },
  { id: "channel_overlap", label: "Channel overlap", signal: "Distribution or partner crossover." },
  { id: "geographic_overlap", label: "Geographic overlap", signal: "Shared go-to-market infrastructure." },
  { id: "talent_overlap", label: "Talent overlap", signal: "Shared hiring pools or leadership." },
  { id: "tech_ip_overlap", label: "Tech / IP overlap", signal: "Shared platforms or licensable IP." },
  { id: "capital_structure", label: "Capital structure", signal: "Refinancing or shared lenders." },
  { id: "macro_exposure", label: "Macro exposure", signal: "Correlated macro risks." },
] as const;

const DETECTOR_IDS = SYNERGY_DETECTORS.map((d) => d.id);

const MIN_COMPANIES = 2;
const MAX_COMPANIES = 6;
const MAX_CANDIDATES = 15;
const VALUES = ["low", "medium", "high"] as const;

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type SynergyValue = (typeof VALUES)[number];

export interface SynergyCandidate {
  detector: string;
  detectorLabel: string;
  /** The companies this synergy spans (≥ 1). */
  companyIds: number[];
  description: string;
  value: SynergyValue;
  /** 0–1 — confidence the synergy is real and capturable. */
  confidence: number;
  recommendedAction: string;
}

export interface SynergyCompany {
  id: number;
  name: string;
}

export interface SynergyScoutResult {
  candidates: SynergyCandidate[];
}

// ─────────────────────────────────────────────────────────────────────────────
// SCHEMA
// ─────────────────────────────────────────────────────────────────────────────

const SCOUT_SCHEMA = {
  name: "synergy_scout",
  strict: false,
  schema: {
    type: "object",
    properties: {
      candidates: {
        type: "array",
        items: {
          type: "object",
          properties: {
            detector: { type: "string", enum: DETECTOR_IDS },
            companies: {
              type: "array",
              items: { type: "string" },
              description: "Names of the companies this synergy spans.",
            },
            description: { type: "string" },
            value: { type: "string", enum: ["low", "medium", "high"] },
            confidence: { type: "number", description: "0-1 confidence the synergy is capturable." },
            recommendedAction: { type: "string" },
          },
          required: ["detector", "description", "value"],
        },
      },
    },
    required: ["candidates"],
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// DEFENSIVE PARSING
// ─────────────────────────────────────────────────────────────────────────────

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" && v.trim() ? v.trim() : fallback;
}

function asConfidence(v: unknown): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return 0.5;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return Math.round(v * 100) / 100;
}

function matchCompany(name: string, companies: SynergyCompany[]): SynergyCompany | undefined {
  const n = name.trim().toLowerCase();
  if (!n) return undefined;
  return (
    companies.find((c) => c.name.trim().toLowerCase() === n) ??
    companies.find(
      (c) => c.name.trim().toLowerCase().includes(n) || n.includes(c.name.trim().toLowerCase()),
    )
  );
}

/** Normalise raw LLM output into a SynergyScoutResult. Exported for tests. */
export function normalizeSynergyResult(
  raw: unknown,
  companies: SynergyCompany[],
): SynergyScoutResult {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const candidates: SynergyCandidate[] = [];

  if (Array.isArray(o.candidates)) {
    for (const item of o.candidates) {
      if (!item || typeof item !== "object") continue;
      const r = item as Record<string, unknown>;
      const description = asString(r.description);
      if (!description) continue;

      const detector = SYNERGY_DETECTORS.find((d) => d.id === asString(r.detector));
      if (!detector) continue;

      const ids: number[] = [];
      if (Array.isArray(r.companies)) {
        for (const c of r.companies) {
          const match = matchCompany(asString(c), companies);
          if (match && !ids.includes(match.id)) ids.push(match.id);
        }
      }

      const valueRaw = asString(r.value).toLowerCase();
      const value = (VALUES as readonly string[]).includes(valueRaw)
        ? (valueRaw as SynergyValue)
        : "medium";

      candidates.push({
        detector: detector.id,
        detectorLabel: detector.label,
        companyIds: ids,
        description,
        value,
        confidence: asConfidence(r.confidence),
        recommendedAction: asString(r.recommendedAction),
      });
      if (candidates.length >= MAX_CANDIDATES) break;
    }
  }

  // Highest value first, then highest confidence.
  const valueRank: Record<SynergyValue, number> = { high: 0, medium: 1, low: 2 };
  candidates.sort(
    (a, b) => valueRank[a.value] - valueRank[b.value] || b.confidence - a.confidence,
  );

  return { candidates };
}

// ─────────────────────────────────────────────────────────────────────────────
// SCOUT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run the Synergy Scout across a portfolio. Each company's context is gathered
 * with a memory search namespaced to that single company (C1). Best-effort.
 *
 * The CALLER is responsible for GP-only authorization and for audit-logging
 * every cross-company memory read.
 */
export async function runSynergyScout(
  companies: SynergyCompany[],
  ctx: RouterContext,
): Promise<SynergyScoutResult> {
  if (companies.length < MIN_COMPANIES) {
    throw new Error(`The Synergy Scout needs at least ${MIN_COMPANIES} companies.`);
  }
  const roster = companies.slice(0, MAX_COMPANIES);

  const blocks: string[] = [];
  for (const company of roster) {
    let memoryContext = "";
    try {
      const memories = await hybridSearchMemory({
        tenantId: ctx.tenantId,
        companyId: company.id,
        query:
          "capabilities customers suppliers channels geography talent technology capital macro exposure",
        limit: 14,
        ctx: { ...ctx, companyId: company.id },
      });
      memoryContext = memories.map((m, i) => `  ${i + 1}. ${m.canonicalForm}`).join("\n");
    } catch {
      memoryContext = "";
    }
    blocks.push(
      `Company: ${company.name}\n` +
        (memoryContext ? `What the platform knows:\n${memoryContext}` : "No company memory available."),
    );
  }

  const detectorList = SYNERGY_DETECTORS.map((d) => `- ${d.id} (${d.label}): ${d.signal}`).join("\n");

  const system =
    "You are the Synergy Scout. Across the portfolio companies below, find the " +
    "concrete synergy candidates — real, capturable overlaps, not generic " +
    "platitudes. Use ONLY these detectors:\n" +
    detectorList +
    "\nFor each candidate name the detector, the companies it spans, the value " +
    "(low/medium/high), a confidence (0-1), and the recommended action.";

  const user =
    `PORTFOLIO COMPANIES:\n\n${blocks.join("\n\n")}\n\n` +
    `Scout for synergies across all ${roster.length} companies.`;

  try {
    const result = await router.structured<Record<string, unknown>>({
      task: "worker",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      schema: SCOUT_SCHEMA as unknown as {
        name: string;
        strict?: boolean;
        schema: Record<string, unknown>;
      },
      ctx,
    });
    return normalizeSynergyResult(result.data, roster);
  } catch {
    return { candidates: [] };
  }
}
