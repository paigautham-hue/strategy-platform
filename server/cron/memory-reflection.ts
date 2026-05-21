/**
 * Memory Reflection Cron — IMPLEMENTATION_PLAN.md Workstream 1.4 · technique T5
 *
 * The compounding-intelligence mechanism (Generative Agents pattern). Nightly,
 * for each company, the platform reads its recent ground-level memory and
 * synthesises a few higher-level strategic INSIGHTS — patterns no single
 * source claim states. Those insights are written back as new memory items
 * one derivation level up (derivationDepth = 1).
 *
 * Recursion is bounded by derivation depth: reflection only ever reads
 * depth-0 ground facts, so reflections are never reflected upon (C4). Their
 * confidence is capped — a synthesised insight is a hypothesis, not a fact.
 *
 * Runs inside the nightly cron (called from runNightlyTelemetry).
 */

import { and, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "../db";
import { companies, memoryItems } from "../../drizzle/schema";
import * as router from "../ai/router";
import type { RouterContext } from "../ai/router";
import { writeMemory } from "../services/memory";

export interface ReflectionResult {
  companiesProcessed: number;
  insightsWritten: number;
  errors: string[];
}

/** A reflection is a hypothesis, not a fact — its confidence is capped here. */
const REFLECTION_CONFIDENCE = 0.55;
/** Minimum ground-level items a company needs before reflection runs. */
const MIN_ITEMS_TO_REFLECT = 8;
/** Most recent ground-level items fed into one reflection pass. */
const REFLECTION_INPUT_LIMIT = 60;
/** Cap on insights kept from one pass. */
const MAX_INSIGHTS = 5;

// ─────────────────────────────────────────────────────────────────────────────
// LLM SCHEMA + OUTPUT NORMALISATION
// ─────────────────────────────────────────────────────────────────────────────

export interface ReflectionInsight {
  insight: string;
  rationale: string;
}

const REFLECTION_SCHEMA = {
  name: "strategic_reflections",
  strict: false,
  schema: {
    type: "object",
    properties: {
      insights: {
        type: "array",
        items: {
          type: "object",
          properties: {
            insight: {
              type: "string",
              description: "A higher-level strategic insight synthesising patterns across the inputs.",
            },
            rationale: {
              type: "string",
              description: "Why this insight follows from the input claims.",
            },
          },
          required: ["insight"],
        },
      },
    },
    required: ["insights"],
  },
} as const;

const SYSTEM_INSTRUCTION =
  "You are the reflective layer of a strategy platform's memory. Given a set of " +
  "ground-level claims about a company, synthesise 3-5 higher-level strategic " +
  "INSIGHTS — patterns, tensions, or implications that no single claim states " +
  "outright. Each insight must be genuinely synthetic, not a restatement.";

/**
 * Normalise raw LLM reflection output into a clean insight list.
 * Exported for unit testing — defensive parsing.
 */
export function normalizeReflectionOutput(raw: unknown): ReflectionInsight[] {
  const list =
    raw && typeof raw === "object" && Array.isArray((raw as { insights?: unknown }).insights)
      ? (raw as { insights: unknown[] }).insights
      : [];

  const out: ReflectionInsight[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const insight = typeof o.insight === "string" ? o.insight.trim() : "";
    if (!insight) continue;
    const rationale = typeof o.rationale === "string" ? o.rationale.trim() : "";
    out.push({ insight, rationale });
    if (out.length >= MAX_INSIGHTS) break;
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// CRON
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run nightly reflection across every company. Never throws — per-company
 * failures are collected into `errors`.
 */
export async function runMemoryReflection(): Promise<ReflectionResult> {
  const db = await getDb();
  if (!db) {
    return { companiesProcessed: 0, insightsWritten: 0, errors: ["DB unavailable"] };
  }

  const allCompanies = await db.select().from(companies);
  const errors: string[] = [];
  let insightsWritten = 0;

  for (const company of allCompanies) {
    try {
      insightsWritten += await reflectOnCompany(db, company.tenantId, company.id);
    } catch (err) {
      errors.push(
        `company ${company.id}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return { companiesProcessed: allCompanies.length, insightsWritten, errors };
}

/** Reflect on one company's recent ground-level memory. Returns insights written. */
async function reflectOnCompany(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  tenantId: string,
  companyId: number,
): Promise<number> {
  // Ground-level only (derivationDepth = 0) so reflections are never recursive (C4).
  const items = await db
    .select()
    .from(memoryItems)
    .where(
      and(
        eq(memoryItems.tenantId, tenantId),
        eq(memoryItems.companyId, companyId),
        isNull(memoryItems.invalidAt),
        eq(memoryItems.derivationDepth, 0),
        eq(memoryItems.quarantined, false),
      ),
    )
    .limit(REFLECTION_INPUT_LIMIT)
    .orderBy(sql`${memoryItems.validAt} DESC`);

  if (items.length < MIN_ITEMS_TO_REFLECT) return 0;

  const ctx: RouterContext = { tenantId, companyId };
  const claimList = items.map((it, i) => `${i + 1}. ${it.canonicalForm}`).join("\n");

  let insights: ReflectionInsight[];
  try {
    const result = await router.structured<{ insights: unknown[] }>({
      messages: [
        { role: "system", content: SYSTEM_INSTRUCTION },
        { role: "user", content: `Company claims:\n${claimList}` },
      ],
      schema: REFLECTION_SCHEMA as unknown as {
        name: string;
        strict?: boolean;
        schema: Record<string, unknown>;
      },
      ctx,
    });
    insights = normalizeReflectionOutput(result.data);
  } catch {
    return 0; // reflection is best-effort
  }

  let written = 0;
  for (const { insight, rationale } of insights) {
    await writeMemory({
      tenantId,
      companyId,
      rawContent: rationale ? `${insight} — ${rationale}` : insight,
      canonicalForm: insight,
      confidence: REFLECTION_CONFIDENCE,
      claimModality: "actual",
      derivationDepth: 1, // one level above the ground facts it synthesises
      decayClass: "slow",
      dims: { framework: "reflection" },
    });
    written += 1;
  }
  return written;
}
