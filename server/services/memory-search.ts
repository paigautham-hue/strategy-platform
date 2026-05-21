/**
 * Hybrid Memory Search — IMPLEMENTATION_PLAN.md Workstream 1.3 · technique T7
 *
 * Wires the retrieval primitives into a real search over the memory store:
 *
 *   query → embed → [vector ranking] + [keyword ranking]
 *         → Reciprocal Rank Fusion → MMR diversity → top-K
 *
 * Per MEMORY_AND_LEARNING_REVIEW.md: dense + keyword fused with RRF (k=60
 * fixed, AP7), then MMR for diversity (T7/E3). Company-scoped (C1) and
 * bi-temporal-clamped — only currently-valid items (C19).
 *
 * Phase 1 scores app-side over the company's recent memory (MySQL has no
 * native vector index, OD2). Migrates to a vector index / Zep in a later
 * phase — the ranking contract here is unchanged by that swap.
 */

import { and, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "../db";
import { memoryItems, type MemoryItem } from "../../drizzle/schema";
import * as router from "../ai/router";
import type { RouterContext } from "../ai/router";
import { cosineSimilarity, reciprocalRankFusion, maximalMarginalRelevance } from "../retrieval";
import { appendAudit } from "../middleware/audit";

// ─────────────────────────────────────────────────────────────────────────────
// KEYWORD SCORING  (pure)
// ─────────────────────────────────────────────────────────────────────────────

/** Split a query into lower-cased word tokens (length ≥ 2). */
export function queryTerms(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((t) => t.length >= 2);
}

/**
 * Keyword relevance of `text` to a set of query terms: the count of DISTINCT
 * query terms that appear in the text. Pure and order-independent.
 */
export function keywordScore(text: string, terms: ReadonlyArray<string>): number {
  if (terms.length === 0) return 0;
  const haystack = text.toLowerCase();
  let hits = 0;
  for (const term of Array.from(new Set(terms))) {
    if (haystack.includes(term)) hits += 1;
  }
  return hits;
}

// ─────────────────────────────────────────────────────────────────────────────
// HYBRID SEARCH
// ─────────────────────────────────────────────────────────────────────────────

export interface HybridSearchInput {
  tenantId: string;
  companyId: number;
  projectId?: number;
  query: string;
  limit?: number;
  includeQuarantined?: boolean;
  /** Diversity vs relevance for the MMR pass (0–1). Default 0.5. */
  mmrLambda?: number;
  ctx: RouterContext;
}

/** Max rows pulled into app-side scoring (Phase 1 scale). */
const SCORING_POOL = 500;
const DEFAULT_LIMIT = 20;

/**
 * Hybrid search over a company's memory: dense + keyword, RRF-fused,
 * MMR-diversified. Company-scoped and bi-temporal-clamped.
 *
 * Degrades gracefully: if the query cannot be embedded, falls back to
 * keyword-only ranking rather than failing the search.
 */
export async function hybridSearchMemory(input: HybridSearchInput): Promise<MemoryItem[]> {
  const db = await getDb();
  if (!db) return [];

  const limit = input.limit ?? DEFAULT_LIMIT;

  // Pull the company's currently-valid memory into the scoring pool (C1, C19).
  const conditions = [
    eq(memoryItems.tenantId, input.tenantId),
    eq(memoryItems.companyId, input.companyId),
    isNull(memoryItems.invalidAt),
  ];
  if (!input.includeQuarantined) {
    conditions.push(eq(memoryItems.quarantined, false));
  }
  if (input.projectId) {
    conditions.push(eq(memoryItems.projectId, input.projectId));
  }

  const pool = await db
    .select()
    .from(memoryItems)
    .where(and(...conditions))
    .limit(SCORING_POOL)
    .orderBy(sql`${memoryItems.validAt} DESC`);

  if (pool.length === 0) return [];

  // ── Keyword ranking ────────────────────────────────────────────────────────
  const terms = queryTerms(input.query);
  const keywordRanked = pool
    .map((item) => ({
      item,
      score: keywordScore(`${item.canonicalForm} ${item.rawContent}`, terms),
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.item);

  // ── Vector ranking ─────────────────────────────────────────────────────────
  let vectorRanked: MemoryItem[] = [];
  let queryVec: number[] | null = null;
  try {
    const embedded = await router.embed({ text: input.query, ctx: input.ctx });
    queryVec = embedded.embedding;
  } catch {
    queryVec = null; // graceful fallback to keyword-only
  }

  if (queryVec && queryVec.length > 0) {
    vectorRanked = pool
      .filter((item) => Array.isArray(item.embedding) && item.embedding.length === queryVec!.length)
      .map((item) => ({
        item,
        score: cosineSimilarity(queryVec!, item.embedding as number[]),
      }))
      .sort((a, b) => b.score - a.score)
      .map((x) => x.item);
  }

  // ── Fuse + diversify ───────────────────────────────────────────────────────
  const rankings = [vectorRanked, keywordRanked].filter((r) => r.length > 0);
  if (rankings.length === 0) return [];

  const fused = reciprocalRankFusion(rankings).map((r) => r.item);

  let ordered: MemoryItem[];
  if (queryVec && queryVec.length > 0) {
    // MMR over the fused head — only items whose embedding matches the query dim.
    const head = fused.slice(0, limit * 3);
    const withEmbedding = head.filter(
      (i) => Array.isArray(i.embedding) && i.embedding.length === queryVec!.length,
    );
    const withoutEmbedding = head.filter(
      (i) => !Array.isArray(i.embedding) || i.embedding.length !== queryVec!.length,
    );
    const diversified = maximalMarginalRelevance(
      queryVec,
      withEmbedding.map((i) => ({ item: i, embedding: i.embedding as number[] })),
      { lambda: input.mmrLambda ?? 0.5, k: limit },
    );
    ordered = [...diversified, ...withoutEmbedding];
  } else {
    ordered = fused;
  }

  const finalResults = ordered.slice(0, limit);

  // Audit the read (confidential data, C6) — non-blocking.
  void appendAudit({
    tenantId: input.tenantId,
    companyId: input.companyId,
    userId: input.ctx.userId,
    action: "read",
    resourceType: "memory_item",
    confidentialityTier: "confidential",
    traceId: input.ctx.traceId,
    metadata: { mode: "hybrid", query: input.query, resultCount: finalResults.length },
  });

  return finalResults;
}
