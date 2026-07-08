/**
 * Pattern Mining — IMPLEMENTATION_PLAN.md Phase 6, Workstream 6.2
 *
 * Across a set of past projects, the miner finds the recurring DECISION
 * STRUCTURES — the shapes a strategy tends to take — and the typical outcomes
 * they produce. An anti-pattern detector does the mirror job: it flags the
 * repeated FAILURE SHAPES, so the same mistake is not made a third time.
 *
 * A mined pattern that recurs becomes a candidate for the playbook engine
 * (Workstream 6.3). This agent is stateless reasoning over supplied projects;
 * persisting patterns and the surfacing rules depend on project storage.
 */

import * as router from "../ai/router";
import type { RouterContext } from "../ai/router";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface MinedPattern {
  name: string;
  description: string;
  /** The conditions under which this pattern tends to appear. */
  whenItApplies: string;
  /** What outcome the pattern typically produces. */
  typicalOutcome: string;
  /** How many of the supplied projects exhibit this pattern. */
  support: number;
}

export interface AntiPattern {
  name: string;
  description: string;
  /** The specific way this shape fails. */
  failureMode: string;
  support: number;
}

export interface PatternMiningResult {
  patterns: MinedPattern[];
  antiPatterns: AntiPattern[];
  projectsAnalyzed: number;
}

const MAX_PATTERNS = 8;
const MIN_PROJECTS = 2;

// ─────────────────────────────────────────────────────────────────────────────
// SCHEMA
// ─────────────────────────────────────────────────────────────────────────────

const MINING_SCHEMA = {
  name: "pattern_mining",
  strict: false,
  schema: {
    type: "object",
    properties: {
      patterns: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            description: { type: "string" },
            whenItApplies: { type: "string" },
            typicalOutcome: { type: "string" },
            support: { type: "number", description: "How many supplied projects exhibit this." },
          },
          required: ["name", "description"],
        },
      },
      antiPatterns: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            description: { type: "string" },
            failureMode: { type: "string" },
            support: { type: "number" },
          },
          required: ["name", "description"],
        },
      },
    },
    required: ["patterns", "antiPatterns"],
  },
} as const;

const SYSTEM_INSTRUCTION =
  "You mine a set of past projects for recurring patterns. A PATTERN is a " +
  "decision structure that shows up more than once — name it, describe it, " +
  "say when it applies and what outcome it typically produces. An ANTI-PATTERN " +
  "is a repeated FAILURE shape — name it and the specific failure mode. Only " +
  "report a pattern if it genuinely recurs across the projects; a one-off is " +
  "not a pattern. Estimate `support` — how many of the supplied projects " +
  "exhibit it.";

// ─────────────────────────────────────────────────────────────────────────────
// DEFENSIVE PARSING
// ─────────────────────────────────────────────────────────────────────────────

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" && v.trim() ? v.trim() : fallback;
}

function asSupport(v: unknown, cap: number): number {
  if (typeof v !== "number" || !Number.isFinite(v) || v < 1) return 1;
  return Math.min(Math.floor(v), cap);
}

/** Normalise raw LLM output into a PatternMiningResult. Exported for tests. */
export function normalizeMining(raw: unknown, projectsAnalyzed: number): PatternMiningResult {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;

  const patterns: MinedPattern[] = [];
  if (Array.isArray(o.patterns)) {
    for (const item of o.patterns) {
      if (!item || typeof item !== "object") continue;
      const r = item as Record<string, unknown>;
      const name = asString(r.name);
      const description = asString(r.description);
      if (!name || !description) continue;
      patterns.push({
        name,
        description,
        whenItApplies: asString(r.whenItApplies),
        typicalOutcome: asString(r.typicalOutcome),
        support: asSupport(r.support, Math.max(1, projectsAnalyzed)),
      });
      if (patterns.length >= MAX_PATTERNS) break;
    }
  }

  const antiPatterns: AntiPattern[] = [];
  if (Array.isArray(o.antiPatterns)) {
    for (const item of o.antiPatterns) {
      if (!item || typeof item !== "object") continue;
      const r = item as Record<string, unknown>;
      const name = asString(r.name);
      const description = asString(r.description);
      if (!name || !description) continue;
      antiPatterns.push({
        name,
        description,
        failureMode: asString(r.failureMode),
        support: asSupport(r.support, Math.max(1, projectsAnalyzed)),
      });
      if (antiPatterns.length >= MAX_PATTERNS) break;
    }
  }

  return { patterns, antiPatterns, projectsAnalyzed };
}

// ─────────────────────────────────────────────────────────────────────────────
// MINING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mine a set of past projects for recurring patterns and anti-patterns.
 * Best-effort — returns an empty result on failure. Throws if fewer than two
 * projects are supplied (a pattern needs something to recur across).
 */
export async function minePatterns(
  projects: string[],
  ctx: RouterContext,
): Promise<PatternMiningResult> {
  const cleaned = projects.map((p) => p.trim()).filter(Boolean);
  if (cleaned.length < MIN_PROJECTS) {
    throw new Error(`Pattern mining needs at least ${MIN_PROJECTS} projects.`);
  }

  const rendered = cleaned.map((p, i) => `Project ${i + 1}:\n${p}`).join("\n\n");

  try {
    const result = await router.structured<Record<string, unknown>>({
      task: "worker",
      messages: [
        { role: "system", content: SYSTEM_INSTRUCTION },
        { role: "user", content: `PAST PROJECTS:\n\n${rendered}` },
      ],
      schema: MINING_SCHEMA as unknown as {
        name: string;
        strict?: boolean;
        schema: Record<string, unknown>;
      },
      ctx,
    });
    return normalizeMining(result.data, cleaned.length);
  } catch {
    return { patterns: [], antiPatterns: [], projectsAnalyzed: cleaned.length };
  }
}
