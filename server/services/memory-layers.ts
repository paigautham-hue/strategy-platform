/**
 * Memory Layers — IMPLEMENTATION_PLAN.md Workstream 1.7
 *
 * The six-layer memory model is Session → Project → Company → Portfolio →
 * Global, plus a User layer. Session/Project/Company are handled by the
 * nullable `sessionId` / `projectId` / `companyId` columns on `memory_item`.
 * This module adds the two layers that are NOT company-scoped:
 *
 *   - GLOBAL — framework canon, durable industry knowledge, shared across
 *     every portfolio company in the tenant
 *   - USER   — the GP's own preferences and decision style, an overlay that
 *     cuts across companies
 *
 * Implementation without a schema migration: each layer is held in a reserved
 * Company container (`__global__`, `__user__`) per tenant. Reserved containers
 * are created lazily and are hidden from the company switcher (db.listCompanies
 * filters names beginning with `__`). Layer memory is otherwise ordinary
 * memory — it gets the same extraction, embedding, hygiene, and hybrid search.
 */

import { and, eq } from "drizzle-orm";
import { getDb } from "../db";
import { companies, type MemoryItem } from "../../drizzle/schema";
import { writeMemory } from "./memory";
import { hybridSearchMemory } from "./memory-search";
import type { RouterContext } from "../ai/router";

export type MemoryLayer = "global" | "user";

/** Reserved container name per layer. The `__` prefix marks it hidden. */
const CONTAINER_NAME: Record<MemoryLayer, string> = {
  global: "__global__",
  user: "__user__",
};

/** Visibility tag written on each layer's memory items. */
const LAYER_VISIBILITY: Record<MemoryLayer, "global" | "company"> = {
  global: "global",
  user: "company", // the visibility enum has no "user"; the container is the scope
};

/**
 * Is this a reserved memory-layer container name? Used by db.listCompanies to
 * keep `__global__` / `__user__` out of the company switcher. Pure.
 */
export function isReservedCompanyName(name: string): boolean {
  return name.startsWith("__") && name.endsWith("__");
}

// tenantId:layer → companyId. Reserved containers never change, so cache them.
const containerCache = new Map<string, number>();

/**
 * Resolve (creating on first use) the reserved Company container that holds
 * a tenant's memory for the given layer.
 */
export async function getOrCreateLayerContainer(
  tenantId: string,
  layer: MemoryLayer,
): Promise<number> {
  const cacheKey = `${tenantId}:${layer}`;
  const cached = containerCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const name = CONTAINER_NAME[layer];
  const [existing] = await db
    .select()
    .from(companies)
    .where(and(eq(companies.tenantId, tenantId), eq(companies.name, name)))
    .limit(1);

  let id: number;
  if (existing) {
    id = existing.id;
  } else {
    const [created] = await db
      .insert(companies)
      .values({
        tenantId,
        name,
        industry: "__reserved__",
        description: `Reserved ${layer}-memory container — not a portfolio company.`,
      })
      .$returningId();
    id = created.id;
  }

  containerCache.set(cacheKey, id);
  return id;
}

/** Write a claim into a memory layer (global framework canon, or user prefs). */
export async function writeLayerMemory(
  layer: MemoryLayer,
  tenantId: string,
  rawContent: string,
  ctx: RouterContext,
  opts?: { canonicalForm?: string; confidence?: number },
): Promise<MemoryItem> {
  const companyId = await getOrCreateLayerContainer(tenantId, layer);
  return writeMemory({
    tenantId,
    companyId,
    userId: ctx.userId,
    rawContent,
    canonicalForm: opts?.canonicalForm,
    confidence: opts?.confidence ?? 0.7,
    claimModality: "actual",
    decayClass: layer === "global" ? "permanent" : "slow",
    visibility: LAYER_VISIBILITY[layer],
    traceId: ctx.traceId,
  });
}

/** Hybrid-search a memory layer. */
export async function queryLayerMemory(
  layer: MemoryLayer,
  tenantId: string,
  query: string,
  ctx: RouterContext,
  limit = 10,
): Promise<MemoryItem[]> {
  const companyId = await getOrCreateLayerContainer(tenantId, layer);
  return hybridSearchMemory({
    tenantId,
    companyId,
    query,
    limit,
    ctx: { ...ctx, companyId },
  });
}

export interface LayeredContext {
  company: MemoryItem[];
  global: MemoryItem[];
  user: MemoryItem[];
}

/**
 * Layer-aware retrieval (memory layer routing): for a query in the context of
 * a portfolio company, return the relevant company-layer memory plus the
 * global framework canon and the user's preference overlay.
 */
export async function getLayeredContext(
  tenantId: string,
  companyId: number,
  query: string,
  ctx: RouterContext,
  opts?: { companyLimit?: number; globalLimit?: number; userLimit?: number },
): Promise<LayeredContext> {
  const [company, global, user] = await Promise.all([
    hybridSearchMemory({
      tenantId,
      companyId,
      query,
      limit: opts?.companyLimit ?? 15,
      ctx: { ...ctx, companyId },
    }),
    queryLayerMemory("global", tenantId, query, ctx, opts?.globalLimit ?? 8),
    queryLayerMemory("user", tenantId, query, ctx, opts?.userLimit ?? 5),
  ]);
  return { company, global, user };
}
