/**
 * Cross-Company War-Game — IMPLEMENTATION_PLAN.md Phase 3, Workstream 3.6
 *
 * A single shock — an FX swing, a supplier acquisition, a new regulation —
 * does not hit portfolio companies in isolation. The cross-company war-game
 * plays one shared scenario across two or more portcos and surfaces the
 * non-obvious synergies and correlated risks the GP would otherwise miss.
 *
 * This is the ONE place the platform deliberately reads across company
 * boundaries (C1), so it is GP-only and every cross-company memory read is
 * audit-logged by the caller. The agent itself still namespaces each memory
 * search to a single companyId — it never issues a cross-company query.
 */

import * as router from "../ai/router";
import type { RouterContext } from "../ai/router";
import { hybridSearchMemory } from "../services/memory-search";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface CrossCoCompany {
  id: number;
  name: string;
}

/** How hard the scenario hits a single company. */
export type Exposure = "low" | "medium" | "high";

export interface CrossCoCompanyOutcome {
  companyId: number;
  companyName: string;
  outcome: string;
  exposure: Exposure;
}

/** A non-obvious cross-company synergy or correlated risk. */
export interface CrossCoFinding {
  kind: "synergy" | "risk";
  finding: string;
  /** The companies this finding spans (≥ 1). */
  companyIds: number[];
}

export interface CrossCoWarGameResult {
  scenario: string;
  companyOutcomes: CrossCoCompanyOutcome[];
  findings: CrossCoFinding[];
  /** What the GP should take away at the portfolio level. */
  portfolioImplication: string;
}

const MIN_COMPANIES = 2;
const MAX_COMPANIES = 6;
const MAX_FINDINGS = 12;
const EXPOSURES: readonly Exposure[] = ["low", "medium", "high"];

// ─────────────────────────────────────────────────────────────────────────────
// SCHEMA
// ─────────────────────────────────────────────────────────────────────────────

const CROSS_CO_SCHEMA = {
  name: "cross_co_war_game",
  strict: false,
  schema: {
    type: "object",
    properties: {
      companyOutcomes: {
        type: "array",
        items: {
          type: "object",
          properties: {
            company: { type: "string", description: "The company name, exactly as given." },
            outcome: { type: "string", description: "How the scenario plays out for this company." },
            exposure: { type: "string", enum: ["low", "medium", "high"] },
          },
          required: ["company", "outcome", "exposure"],
        },
      },
      findings: {
        type: "array",
        items: {
          type: "object",
          properties: {
            kind: { type: "string", enum: ["synergy", "risk"] },
            finding: { type: "string", description: "A non-obvious cross-company synergy or correlated risk." },
            companies: {
              type: "array",
              items: { type: "string" },
              description: "Names of the companies this finding spans.",
            },
          },
          required: ["kind", "finding"],
        },
      },
      portfolioImplication: {
        type: "string",
        description: "What the GP should do at the portfolio level.",
      },
    },
    required: ["companyOutcomes", "portfolioImplication"],
  },
} as const;

const SYSTEM_INSTRUCTION =
  "You run a portfolio-level war-game. A single shock is applied to two or " +
  "more portfolio companies at once. For each company, judge how the scenario " +
  "plays out and how exposed it is. Then find the NON-OBVIOUS cross-company " +
  "effects — shared dependencies, correlated risks, hedges, or synergies one " +
  "company's response creates for another. Close with what the GP should do " +
  "at the portfolio level. Be concrete; a generic finding is worthless.";

// ─────────────────────────────────────────────────────────────────────────────
// DEFENSIVE PARSING
// ─────────────────────────────────────────────────────────────────────────────

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" && v.trim() ? v.trim() : fallback;
}

/** Resolve a model-provided company name to a known company (case-insensitive). */
function matchCompany(name: string, companies: CrossCoCompany[]): CrossCoCompany | undefined {
  const n = name.trim().toLowerCase();
  if (!n) return undefined;
  return (
    companies.find((c) => c.name.trim().toLowerCase() === n) ??
    companies.find((c) => c.name.trim().toLowerCase().includes(n) || n.includes(c.name.trim().toLowerCase()))
  );
}

/**
 * Normalise raw LLM output into a CrossCoWarGameResult, resolving company
 * names back to IDs against the known company list. Exported for tests.
 */
export function normalizeCrossCoResult(
  raw: unknown,
  scenario: string,
  companies: CrossCoCompany[],
): CrossCoWarGameResult {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;

  const companyOutcomes: CrossCoCompanyOutcome[] = [];
  const seen = new Set<number>();
  if (Array.isArray(o.companyOutcomes)) {
    for (const item of o.companyOutcomes) {
      if (!item || typeof item !== "object") continue;
      const r = item as Record<string, unknown>;
      const outcome = asString(r.outcome);
      if (!outcome) continue;
      const company = matchCompany(asString(r.company), companies);
      if (!company || seen.has(company.id)) continue;
      seen.add(company.id);
      const expRaw = asString(r.exposure).toLowerCase();
      const exposure = (EXPOSURES as readonly string[]).includes(expRaw)
        ? (expRaw as Exposure)
        : "medium";
      companyOutcomes.push({
        companyId: company.id,
        companyName: company.name,
        outcome,
        exposure,
      });
    }
  }

  const findings: CrossCoFinding[] = [];
  if (Array.isArray(o.findings)) {
    for (const item of o.findings) {
      if (!item || typeof item !== "object") continue;
      const r = item as Record<string, unknown>;
      const finding = asString(r.finding);
      if (!finding) continue;
      const kind = asString(r.kind).toLowerCase() === "synergy" ? "synergy" : "risk";
      const ids: number[] = [];
      if (Array.isArray(r.companies)) {
        for (const c of r.companies) {
          const match = matchCompany(asString(c), companies);
          if (match && !ids.includes(match.id)) ids.push(match.id);
        }
      }
      findings.push({ kind, finding, companyIds: ids });
      if (findings.length >= MAX_FINDINGS) break;
    }
  }

  return {
    scenario,
    companyOutcomes,
    findings,
    portfolioImplication: asString(
      o.portfolioImplication,
      "The cross-company war-game produced no clear portfolio implication.",
    ),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SIMULATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run a cross-company war-game for a shared scenario. Each company's context
 * is gathered with a memory search namespaced to that single company — the
 * agent never issues a cross-company query (C1). Best-effort: a company whose
 * memory search fails simply contributes no context.
 *
 * The CALLER is responsible for GP-only authorization and for audit-logging
 * every cross-company memory read (Workstream 3.6 three-layer enforcement).
 */
export async function runCrossCoWarGame(
  scenario: string,
  companies: CrossCoCompany[],
  ctx: RouterContext,
): Promise<CrossCoWarGameResult> {
  if (companies.length < MIN_COMPANIES) {
    throw new Error(`A cross-company war-game needs at least ${MIN_COMPANIES} companies.`);
  }
  const roster = companies.slice(0, MAX_COMPANIES);

  // Gather each company's context — one namespaced search per company.
  const blocks: string[] = [];
  for (const company of roster) {
    let memoryContext = "";
    try {
      const memories = await hybridSearchMemory({
        tenantId: ctx.tenantId,
        companyId: company.id,
        query: scenario,
        limit: 10,
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

  const user =
    `SHARED SCENARIO / SHOCK:\n${scenario}\n\n` +
    `PORTFOLIO COMPANIES IN SCOPE:\n${blocks.join("\n\n")}\n\n` +
    `Play the scenario out across all ${roster.length} companies at once.`;

  try {
    const result = await router.structured<Record<string, unknown>>({
      task: "planner",
      messages: [
        { role: "system", content: SYSTEM_INSTRUCTION },
        { role: "user", content: user },
      ],
      schema: CROSS_CO_SCHEMA as unknown as {
        name: string;
        strict?: boolean;
        schema: Record<string, unknown>;
      },
      ctx,
    });
    return normalizeCrossCoResult(result.data, scenario, roster);
  } catch {
    return {
      scenario,
      companyOutcomes: [],
      findings: [],
      portfolioImplication: "The cross-company war-game could not complete.",
    };
  }
}
