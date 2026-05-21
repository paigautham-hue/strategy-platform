/**
 * Contradiction Review — IMPLEMENTATION_PLAN.md Phase 2, Workstream 2.6
 *
 * The ingest pipeline opens a contradiction edge when a new claim conflicts
 * with an existing one (C23). Both memory items stay valid — a contradiction
 * is recorded, not auto-resolved (C19). This module lists open contradictions
 * for human review and applies a resolution:
 *
 *   resolved_in_favor_of_a  → memory item B is retired (invalidAt set)
 *   resolved_in_favor_of_b  → memory item A is retired
 *   both_valid_with_scope   → both stay valid; the conflict is scope-specific
 *
 * Resolution never deletes — the losing item is superseded, not removed (C19).
 */

import { and, eq } from "drizzle-orm";
import { getDb } from "../db";
import { contradictions, memoryItems } from "../../drizzle/schema";
import { appendAudit } from "../middleware/audit";

export type ContradictionResolution =
  | "resolved_in_favor_of_a"
  | "resolved_in_favor_of_b"
  | "both_valid_with_scope";

/** A contradiction joined with both memory items, for review display. */
export interface ContradictionView {
  id: number;
  status: string;
  notes: string | null;
  createdAt: Date;
  a: { id: number; canonicalForm: string; confidence: number; rawContent: string } | null;
  b: { id: number; canonicalForm: string; confidence: number; rawContent: string } | null;
}

/**
 * Which memory item a resolution retires. `null` means neither is retired
 * (both_valid_with_scope). Pure — exported for unit testing.
 */
export function itemRetiredBy(
  resolution: ContradictionResolution,
  aId: number,
  bId: number,
): number | null {
  switch (resolution) {
    case "resolved_in_favor_of_a":
      return bId; // A wins → B is retired
    case "resolved_in_favor_of_b":
      return aId; // B wins → A is retired
    case "both_valid_with_scope":
      return null;
  }
}

/** The memory item the loser is superseded by (the winner), or null. */
export function winnerOf(
  resolution: ContradictionResolution,
  aId: number,
  bId: number,
): number | null {
  switch (resolution) {
    case "resolved_in_favor_of_a":
      return aId;
    case "resolved_in_favor_of_b":
      return bId;
    case "both_valid_with_scope":
      return null;
  }
}

/** List contradictions for a company, newest first. Joins both memory items. */
export async function listContradictions(
  tenantId: string,
  companyId: number,
  opts?: { status?: string; limit?: number },
): Promise<ContradictionView[]> {
  const db = await getDb();
  if (!db) return [];

  const conditions = [
    eq(contradictions.tenantId, tenantId),
    eq(contradictions.companyId, companyId),
  ];
  if (opts?.status) conditions.push(eq(contradictions.status, opts.status as never));

  const rows = await db
    .select()
    .from(contradictions)
    .where(and(...conditions))
    .limit(opts?.limit ?? 50);

  // Resolve the referenced memory items (small N — fetch per contradiction).
  const views: ContradictionView[] = [];
  for (const row of rows) {
    const [aRow] = await db
      .select()
      .from(memoryItems)
      .where(eq(memoryItems.id, row.aId))
      .limit(1);
    const [bRow] = await db
      .select()
      .from(memoryItems)
      .where(eq(memoryItems.id, row.bId))
      .limit(1);
    views.push({
      id: row.id,
      status: row.status,
      notes: row.notes,
      createdAt: row.createdAt,
      a: aRow
        ? {
            id: aRow.id,
            canonicalForm: aRow.canonicalForm,
            confidence: aRow.confidence ?? 0.5,
            rawContent: aRow.rawContent,
          }
        : null,
      b: bRow
        ? {
            id: bRow.id,
            canonicalForm: bRow.canonicalForm,
            confidence: bRow.confidence ?? 0.5,
            rawContent: bRow.rawContent,
          }
        : null,
    });
  }
  return views;
}

/**
 * Resolve a contradiction. Retires the losing memory item (in-favor cases) by
 * setting its `invalidAt` and pointing `supersededById` at the winner — never
 * a delete (C19). Company-scoped (C1).
 */
export async function resolveContradiction(params: {
  contradictionId: number;
  tenantId: string;
  companyId: number;
  resolution: ContradictionResolution;
  resolvedBy?: number;
  notes?: string;
}): Promise<{ resolved: true; retiredItemId: number | null }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Verify the contradiction belongs to this tenant/company (C1).
  const [row] = await db
    .select()
    .from(contradictions)
    .where(
      and(
        eq(contradictions.id, params.contradictionId),
        eq(contradictions.tenantId, params.tenantId),
        eq(contradictions.companyId, params.companyId),
      ),
    )
    .limit(1);
  if (!row) {
    throw new Error(`Contradiction ${params.contradictionId} not found or access denied`);
  }

  const now = new Date();
  const retiredItemId = itemRetiredBy(params.resolution, row.aId, row.bId);
  const winnerId = winnerOf(params.resolution, row.aId, row.bId);

  await db.transaction(async (tx) => {
    // Retire the losing memory item, if any (C19 — supersede, never delete).
    if (retiredItemId !== null) {
      await tx
        .update(memoryItems)
        .set({ invalidAt: now, supersededById: winnerId ?? undefined })
        .where(eq(memoryItems.id, retiredItemId));
    }
    // Mark the contradiction resolved.
    await tx
      .update(contradictions)
      .set({
        status: params.resolution,
        resolvedBy: params.resolvedBy,
        resolvedAt: now,
        notes: params.notes ?? row.notes,
      })
      .where(eq(contradictions.id, params.contradictionId));
  });

  void appendAudit({
    tenantId: params.tenantId,
    companyId: params.companyId,
    userId: params.resolvedBy,
    action: "write",
    resourceType: "contradiction",
    resourceId: String(params.contradictionId),
    confidentialityTier: "confidential",
    metadata: { resolution: params.resolution, retiredItemId },
  });

  return { resolved: true, retiredItemId };
}
