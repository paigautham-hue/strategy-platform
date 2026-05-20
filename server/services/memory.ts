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
import { memoryItems, type MemoryItem } from "../../drizzle/schema";
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
  let embedding: number[] | undefined;
  let embeddingModelVersion = "openai-text-embedding-3-small-v1";
  try {
    const embedResult = await router.embed({ text: canonicalForm, ctx });
    embedding = embedResult.embedding;
    embeddingModelVersion = embedResult.modelVersion;
  } catch (err) {
    console.warn("[memory] Embedding failed, storing without vector:", err);
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
    quarantined: false,
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
 * Never calls DELETE. C19 compliant.
 */
export async function supersedeMemory(
  oldItemId: number,
  newContent: WriteMemoryInput
): Promise<MemoryItem> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Mark old item as invalid (C19)
  await db
    .update(memoryItems)
    .set({ invalidAt: new Date(), supersededById: -1 /* placeholder */ })
    .where(eq(memoryItems.id, oldItemId));

  // Create new item
  const newItem = await writeMemory(newContent);

  // Link old item to new item
  await db
    .update(memoryItems)
    .set({ supersededById: newItem.id })
    .where(eq(memoryItems.id, oldItemId));

  return newItem;
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
