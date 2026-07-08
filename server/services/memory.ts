/**
 * Memory service — P2, C1, C19, C20, C21, C22
 *
 * write_memory(): normalizes to canonical form, embeds, stores with full namespacing.
 * query_memory(): company-scoped isolation enforced on every read.
 * supersede_memory(): bi-temporal update — never deletes.
 * aggregate_confidence(): Phase 0 stub for Bayesian aggregation (C21).
 */

import { nanoid } from "nanoid";
import { and, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "../db";
import { memoryItems, contradictions, type MemoryItem } from "../../drizzle/schema";
import * as router from "../ai/router";
import { appendAudit, emitUsage } from "../middleware/audit";
import type { RouterContext } from "../ai/router";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WriteMemoryInput {
  tenantId: string;
  companyId: number;
  projectId?: number;
  sessionId?: number;
  userId?: number;
  rawContent: string;
  /** Optional: if not provided, LLM will normalize to canonical form (C20) */
  canonicalForm?: string;
  confidence?: number;
  claimModality?: "actual" | "hypothetical" | "simulated" | "counterfactual";
  derivationDepth?: number;
  sourceUrl?: string;
  provenanceClusterId?: string;
  /** Dimensional tags */
  dims?: {
    market?: string;
    segment?: string;
    product?: string;
    geo?: string;
    channel?: string;
    tech?: string;
    capability?: string;
    framework?: string;
    horizon?: string;
  };
  decayClass?: "permanent" | "slow" | "fast" | "ephemeral";
  visibility?: "company" | "portfolio" | "global";
  idempotencyKey?: string;
  /** C24 — withhold from Portfolio/Global retrieval until corroborated. */
  quarantined?: boolean;
  traceId?: string;
}

export interface QueryMemoryInput {
  tenantId: string;
  companyId: number;
  projectId?: number;
  query?: string;
  limit?: number;
  includeQuarantined?: boolean;
  userId?: number;
  traceId?: string;
}

// ─── Canonical form normalization (C20) ──────────────────────────────────────

/**
 * Normalize raw content to S-P-O-qualifier canonical form using the LLM router.
 * C20: Only canonical form is embedded. Both raw and canonical are stored.
 */
async function normalizeToCanonicalForm(
  rawContent: string,
  ctx: RouterContext
): Promise<string> {
  try {
    const result = await router.structured<{ canonical_form: string }>({
      messages: [
        {
          role: "user",
          content: `Normalize the following claim to a concise Subject-Predicate-Object-Qualifier (S-P-O-Q) canonical form suitable for semantic indexing. Return only the canonical form, no explanation.\n\nClaim: ${rawContent}`,
        },
      ],
      schema: {
        name: "canonical_form",
        strict: true,
        schema: {
          type: "object",
          properties: {
            canonical_form: {
              type: "string",
              description: "The S-P-O-Q normalized canonical form of the claim",
            },
          },
          required: ["canonical_form"],
          additionalProperties: false,
        },
      },
      ctx,
    });
    return result.data.canonical_form || rawContent;
  } catch {
    // Fallback to raw content if normalization fails
    return rawContent;
  }
}

// ─── write_memory ─────────────────────────────────────────────────────────────

export async function writeMemory(input: WriteMemoryInput): Promise<MemoryItem> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const traceId = input.traceId ?? nanoid(16);
  const idempotencyKey = input.idempotencyKey ?? nanoid(32);
  const provenanceClusterId = input.provenanceClusterId ?? nanoid(16);

  // C12: idempotency — when the caller supplied a key, a retry must return the
  // existing row instead of creating a duplicate (and must not re-spend on
  // normalization/embedding).
  if (input.idempotencyKey) {
    const [existing] = await db
      .select()
      .from(memoryItems)
      .where(
        and(
          eq(memoryItems.tenantId, input.tenantId),
          eq(memoryItems.companyId, input.companyId),
          eq(memoryItems.idempotencyKey, input.idempotencyKey),
        )
      )
      .limit(1);
    if (existing) return existing;
  }

  const ctx: RouterContext = {
    tenantId: input.tenantId,
    companyId: input.companyId,
    projectId: input.projectId,
    sessionId: input.sessionId,
    userId: input.userId,
    traceId,
  };

  // C20: Normalize to canonical form (LLM call through router)
  const canonicalForm = input.canonicalForm ?? await normalizeToCanonicalForm(input.rawContent, ctx);

  // C22: Embed canonical form (not raw content)
  // B3: embeddingModelVersion must be truthful — only set from the provider response.
  // If embedding fails, store a sentinel "none" (no model was called) rather than a
  // hardcoded label that would falsely imply an OpenAI response was received.
  let embedding: number[] | undefined;
  let embeddingModelVersion = "none"; // sentinel: no embedding produced
  try {
    const embedResult = await router.embed({ text: canonicalForm, ctx });
    embedding = embedResult.embedding;
    // B3: stamp with the exact model string returned by OpenAI (e.g. "openai:text-embedding-3-small:dims=1536")
    embeddingModelVersion = embedResult.modelVersion;
  } catch (err) {
    console.warn("[memory] Embedding failed, storing without vector:", err);
    // embeddingModelVersion stays "none" — truthful: no embedding was produced
  }

  const sourceDomain = input.sourceUrl
    ? (() => { try { return new URL(input.sourceUrl).hostname; } catch { return undefined; } })()
    : undefined;

  const [inserted] = await db.insert(memoryItems).values({
    tenantId: input.tenantId,
    companyId: input.companyId,
    projectId: input.projectId,
    sessionId: input.sessionId,
    rawContent: input.rawContent,
    canonicalForm,
    embeddingModelVersion,
    embedding: embedding ?? null,
    validAt: new Date(),
    ingestedAt: new Date(),
    provenanceClusterId,
    sourceUrl: input.sourceUrl,
    sourceDomain,
    confidence: input.confidence ?? 0.5,
    claimModality: input.claimModality ?? "actual",
    derivationDepth: input.derivationDepth ?? 0,
    quarantined: input.quarantined ?? false,
    dimMarket: input.dims?.market,
    dimSegment: input.dims?.segment,
    dimProduct: input.dims?.product,
    dimGeo: input.dims?.geo,
    dimChannel: input.dims?.channel,
    dimTech: input.dims?.tech,
    dimCapability: input.dims?.capability,
    dimFramework: input.dims?.framework,
    dimHorizon: input.dims?.horizon,
    decayClass: input.decayClass ?? "slow",
    visibility: input.visibility ?? "company",
    idempotencyKey,
  }).$returningId();

  // Fetch the inserted row
  const [row] = await db
    .select()
    .from(memoryItems)
    .where(eq(memoryItems.id, inserted.id))
    .limit(1);

  // Audit + usage events (non-blocking)
  void appendAudit({
    tenantId: input.tenantId,
    companyId: input.companyId,
    projectId: input.projectId,
    sessionId: input.sessionId,
    userId: input.userId,
    action: "write",
    resourceType: "memory_item",
    resourceId: String(inserted.id),
    confidentialityTier: "confidential",
    traceId,
  });

  void emitUsage({
    tenantId: input.tenantId,
    companyId: input.companyId,
    projectId: input.projectId,
    sessionId: input.sessionId,
    userId: input.userId,
    surface: "api",
    action: "write-memory",
    metadata: { memoryItemId: inserted.id },
  });

  return row;
}

// ─── supersede_memory (C19) ───────────────────────────────────────────────────

/**
 * Bi-temporal update: mark old item as invalid, create new one.
 * Runs in a single DB transaction — no -1 placeholder (M2).
 * Never calls DELETE. C19 compliant.
 *
 * Transaction flow:
 *   1. Insert the new memory item (with all embeddings).
 *   2. In the same transaction: set invalidAt=now() and supersededById=newItem.id on the old row.
 */
export async function supersedeMemory(
  oldItemId: number,
  newContent: WriteMemoryInput
): Promise<MemoryItem> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // C1: the old item must exist in the SAME tenant + company as the new
  // content — otherwise a caller with access to company A could retire
  // company B's memory by guessing an id (IDOR). Also guards the silent
  // bi-temporal break where a bogus oldItemId inserted the new row while
  // invalidating nothing.
  const [oldItem] = await db
    .select({ id: memoryItems.id, invalidAt: memoryItems.invalidAt })
    .from(memoryItems)
    .where(
      and(
        eq(memoryItems.id, oldItemId),
        eq(memoryItems.tenantId, newContent.tenantId),
        eq(memoryItems.companyId, newContent.companyId),
      )
    )
    .limit(1);
  if (!oldItem) {
    throw new Error(`Memory item ${oldItemId} not found in this company — nothing superseded.`);
  }
  if (oldItem.invalidAt) {
    throw new Error(`Memory item ${oldItemId} is already invalidated — supersede the current item instead.`);
  }

  // Step 1: Prepare all data for the new item BEFORE opening the transaction
  // (embedding call can be slow; we don't want to hold a transaction open during it)
  const traceId = newContent.traceId ?? nanoid(16);
  const idempotencyKey = newContent.idempotencyKey ?? nanoid(32);
  const provenanceClusterId = newContent.provenanceClusterId ?? nanoid(16);

  const ctx: RouterContext = {
    tenantId: newContent.tenantId,
    companyId: newContent.companyId,
    projectId: newContent.projectId,
    sessionId: newContent.sessionId,
    userId: newContent.userId,
    traceId,
  };

  // C20: Normalize to canonical form outside the transaction
  const canonicalForm = newContent.canonicalForm ?? await normalizeToCanonicalForm(newContent.rawContent, ctx);

  // C22: Embed canonical form outside the transaction
  let embedding: number[] | undefined;
  let embeddingModelVersion = "unknown";
  try {
    const embedResult = await router.embed({ text: canonicalForm, ctx });
    embedding = embedResult.embedding;
    // B3: stamp with the model string returned by the embedding provider
    embeddingModelVersion = embedResult.modelVersion;
  } catch (err) {
    console.warn("[memory] Embedding failed in supersede, storing without vector:", err);
  }

  const sourceDomain = newContent.sourceUrl
    ? (() => { try { return new URL(newContent.sourceUrl).hostname; } catch { return undefined; } })()
    : undefined;

  const now = new Date();

  // Step 2: Single transaction — insert new row + invalidate old row atomically (M2)
  let newItemId: number;
  await db.transaction(async (tx) => {
    // Insert new memory item
    const [inserted] = await tx.insert(memoryItems).values({
      tenantId: newContent.tenantId,
      companyId: newContent.companyId,
      projectId: newContent.projectId,
      sessionId: newContent.sessionId,
      rawContent: newContent.rawContent,
      canonicalForm,
      embeddingModelVersion,
      embedding: embedding ?? null,
      validAt: now,
      ingestedAt: now,
      provenanceClusterId,
      sourceUrl: newContent.sourceUrl,
      sourceDomain,
      confidence: newContent.confidence ?? 0.5,
      claimModality: newContent.claimModality ?? "actual",
      derivationDepth: newContent.derivationDepth ?? 0,
      quarantined: newContent.quarantined ?? false,
      dimMarket: newContent.dims?.market,
      dimSegment: newContent.dims?.segment,
      dimProduct: newContent.dims?.product,
      dimGeo: newContent.dims?.geo,
      dimChannel: newContent.dims?.channel,
      dimTech: newContent.dims?.tech,
      dimCapability: newContent.dims?.capability,
      dimFramework: newContent.dims?.framework,
      dimHorizon: newContent.dims?.horizon,
      decayClass: newContent.decayClass ?? "slow",
      visibility: newContent.visibility ?? "company",
      idempotencyKey,
    }).$returningId();

    newItemId = inserted.id;

    // Atomically invalidate the old item and link it to the new one — no -1 placeholder
    await tx
      .update(memoryItems)
      .set({ invalidAt: now, supersededById: newItemId })
      .where(eq(memoryItems.id, oldItemId));
  });

  // Fetch the newly inserted row
  const [newItem] = await db
    .select()
    .from(memoryItems)
    .where(eq(memoryItems.id, newItemId!))
    .limit(1);

  // Audit + usage events (non-blocking)
  void appendAudit({
    tenantId: newContent.tenantId,
    companyId: newContent.companyId,
    projectId: newContent.projectId,
    sessionId: newContent.sessionId,
    userId: newContent.userId,
    action: "write",
    resourceType: "memory_item",
    resourceId: String(newItemId!),
    confidentialityTier: "confidential",
    traceId,
    metadata: { supersededId: oldItemId },
  });

  void emitUsage({
    tenantId: newContent.tenantId,
    companyId: newContent.companyId,
    projectId: newContent.projectId,
    sessionId: newContent.sessionId,
    userId: newContent.userId,
    surface: "api",
    action: "write-memory",
    metadata: { memoryItemId: newItemId!, supersededId: oldItemId },
  });

  return newItem;
}

// ─── purge_memory ─────────────────────────────────────────────────────────────
// C19's supersede-never-delete protects the history of REAL beliefs. Purge
// exists for the other case: dummy/test/wrong data that was never a belief at
// all. It hard-deletes, is operator-gated at the router, and every purge is
// audit-logged with what was removed.

/** Hard-delete a single memory item (tenant + company scoped). Returns true if deleted. */
export async function purgeMemoryItem(params: {
  tenantId: string;
  userId?: number;
  itemId: number;
  /** C1: the item must belong to this company — the caller's access was checked against it. */
  companyId: number;
}): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  // Fetch first so the audit entry records what was removed (C1: tenant+company scoped).
  const [item] = await db
    .select()
    .from(memoryItems)
    .where(
      and(
        eq(memoryItems.id, params.itemId),
        eq(memoryItems.tenantId, params.tenantId),
        eq(memoryItems.companyId, params.companyId),
      )
    )
    .limit(1);
  if (!item) return false;

  await db
    .delete(memoryItems)
    .where(
      and(
        eq(memoryItems.id, params.itemId),
        eq(memoryItems.tenantId, params.tenantId),
        eq(memoryItems.companyId, params.companyId),
      )
    );

  void appendAudit({
    tenantId: params.tenantId,
    companyId: item.companyId,
    projectId: item.projectId ?? undefined,
    userId: params.userId,
    action: "delete",
    resourceType: "memory_item",
    resourceId: String(params.itemId),
    confidentialityTier: "confidential",
    metadata: { purged: true, canonicalForm: item.canonicalForm?.slice(0, 200) },
  });
  return true;
}

/**
 * Hard-delete ALL memory for a company (optionally scoped to one project).
 * Returns the number of rows removed.
 */
export async function purgeCompanyMemory(params: {
  tenantId: string;
  userId?: number;
  companyId: number;
  projectId?: number;
}): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  const scope = [
    eq(memoryItems.tenantId, params.tenantId),
    eq(memoryItems.companyId, params.companyId),
    ...(params.projectId !== undefined ? [eq(memoryItems.projectId, params.projectId)] : []),
  ];

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(memoryItems)
    .where(and(...scope));

  if (Number(count) > 0) {
    await db.delete(memoryItems).where(and(...scope));
    // Contradiction edges reference memory ids — clear the company's edges too
    // so nothing points at rows that no longer exist.
    if (params.projectId === undefined) {
      await db
        .delete(contradictions)
        .where(
          and(
            eq(contradictions.tenantId, params.tenantId),
            eq(contradictions.companyId, params.companyId)
          )
        );
    }
  }

  void appendAudit({
    tenantId: params.tenantId,
    companyId: params.companyId,
    projectId: params.projectId,
    userId: params.userId,
    action: "delete",
    resourceType: "memory_item",
    resourceId: params.projectId !== undefined ? `project:${params.projectId}` : `company:${params.companyId}`,
    confidentialityTier: "confidential",
    metadata: { purged: true, scope: params.projectId !== undefined ? "project" : "company", rows: Number(count) },
  });

  return Number(count);
}

// ─── query_memory ─────────────────────────────────────────────────────────────

/**
 * Query memory items with company-scoped isolation.
 * C1: Cross-tenant reads return nothing.
 * C19: Only currently valid items (invalidAt IS NULL) by default.
 */
export async function queryMemory(input: QueryMemoryInput): Promise<MemoryItem[]> {
  const db = await getDb();
  if (!db) return [];

  const conditions = [
    eq(memoryItems.tenantId, input.tenantId),
    eq(memoryItems.companyId, input.companyId), // C1: company isolation
    isNull(memoryItems.invalidAt), // C19: only currently valid
  ];

  if (!input.includeQuarantined) {
    conditions.push(eq(memoryItems.quarantined, false));
  }

  if (input.projectId) {
    conditions.push(eq(memoryItems.projectId, input.projectId));
  }

  const rows = await db
    .select()
    .from(memoryItems)
    .where(and(...conditions))
    .limit(input.limit ?? 20)
    .orderBy(sql`${memoryItems.validAt} DESC`);

  // Keyword filter if query provided (Phase 0; replace with vector search in Phase 1)
  const filtered = input.query
    ? rows.filter((r) =>
        r.canonicalForm.toLowerCase().includes(input.query!.toLowerCase()) ||
        r.rawContent.toLowerCase().includes(input.query!.toLowerCase())
      )
    : rows;

  // Audit the read (non-blocking)
  void appendAudit({
    tenantId: input.tenantId,
    companyId: input.companyId,
    userId: input.userId,
    action: "read",
    resourceType: "memory_item",
    confidentialityTier: "confidential",
    traceId: input.traceId,
    metadata: { query: input.query, resultCount: filtered.length },
  });

  return filtered;
}

// ─── aggregate_confidence (C21 stub) ─────────────────────────────────────────

/**
 * Phase 0 stub for Bayesian confidence aggregation.
 * C21: provenance_cluster_id groups related claims.
 * Phase 1 will implement full Bayesian update.
 *
 * @param provenanceClusterId - The cluster to aggregate
 * @param tenantId - Tenant scope
 * @param companyId - Company scope
 * @returns Aggregated confidence score [0, 1]
 */
export async function aggregateConfidence(
  provenanceClusterId: string,
  tenantId: string,
  companyId: number
): Promise<number> {
  const db = await getDb();
  if (!db) return 0.5;

  const rows = await db
    .select({ confidence: memoryItems.confidence })
    .from(memoryItems)
    .where(
      and(
        eq(memoryItems.tenantId, tenantId),
        eq(memoryItems.companyId, companyId),
        eq(memoryItems.provenanceClusterId, provenanceClusterId),
        isNull(memoryItems.invalidAt)
      )
    );

  if (rows.length === 0) return 0.5;

  // Phase 0: simple arithmetic mean
  // Phase 1: replace with Bayesian update using source_trust_register priors
  const mean = rows.reduce((sum, r) => sum + (r.confidence ?? 0.5), 0) / rows.length;
  return Math.min(1, Math.max(0, mean));
}

// ─── link_contradiction (C19, I1) ─────────────────────────────────────────────

export interface LinkContradictionInput {
  tenantId: string;
  companyId: number;
  /** The existing memory item. */
  aId: number;
  /** The newly-ingested conflicting memory item. */
  bId: number;
  notes?: string;
}

/**
 * Open a contradiction edge between two memory items. Idempotent: the
 * unique constraint on (aId, bId) means a repeated call updates rather than
 * duplicates (I1). Both items remain valid — a contradiction is recorded,
 * not resolved (C19); resolution is a deliberate later act.
 */
export async function linkContradiction(input: LinkContradictionInput): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .insert(contradictions)
    .values({
      tenantId: input.tenantId,
      companyId: input.companyId,
      aId: input.aId,
      bId: input.bId,
      status: "open",
      notes: input.notes,
    })
    .onDuplicateKeyUpdate({ set: { updatedAt: new Date() } });

  void appendAudit({
    tenantId: input.tenantId,
    companyId: input.companyId,
    action: "write",
    resourceType: "contradiction",
    resourceId: `${input.aId}-${input.bId}`,
    confidentialityTier: "confidential",
  });
}
