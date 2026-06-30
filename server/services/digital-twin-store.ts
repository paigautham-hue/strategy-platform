/**
 * Digital Twin persistence (Phase 1 — salvaged from Dynamo)
 *
 * Makes the Digital Twin engine (server/services/digital-twin.ts, which is pure
 * and stateless) STATEFUL: it persists each captured dimension and the rolling
 * completeness signal. Tenant-scoped on every operation (C1). DB writers are
 * getDb-guarded — a no-op when no database is configured (dev/test).
 */

import { eq, and } from "drizzle-orm";
import { getDb } from "../db";
import { digitalTwins, completenessTracking, sessions } from "../../drizzle/schema";
import {
  type Dimension,
  type DimensionCoverage,
  DIMENSION_KEYS,
  overallCompleteness,
} from "./digital-twin";

export type TwinSummary = Partial<Record<Dimension, string>>;

export interface CompletenessRow {
  businessModel: number;
  financials: number;
  operations: number;
  organization: number;
  technology: number;
  overall: number;
}

/** Flatten a coverage map into a persistable completeness row. Pure — unit-tested. */
export function completenessRow(coverage: DimensionCoverage): CompletenessRow {
  return {
    businessModel: coverage.businessModel,
    financials: coverage.financials,
    operations: coverage.operations,
    organization: coverage.organization,
    technology: coverage.technology,
    overall: overallCompleteness(coverage),
  };
}

export interface UpsertDimensionInput {
  tenantId: string;
  companyId: number;
  dimension: Dimension;
  summary: string;
  structured?: Record<string, unknown>;
  confidence?: number;
}

/** Upsert one captured dimension of a company's Digital Twin. */
export async function upsertTwinDimension(input: UpsertDimensionInput): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const hasConfidence = input.confidence !== undefined && input.confidence !== null;
  const confidence = hasConfidence ? Math.max(0, Math.min(100, Math.round(input.confidence as number))) : 0;

  // On update, only touch fields that were actually provided — re-saving a loaded
  // dimension (summary only) must NOT clobber a prior confidence/structured to a default.
  const updateSet: Record<string, unknown> = { summary: input.summary };
  if (input.structured !== undefined) updateSet.structured = input.structured;
  if (hasConfidence) updateSet.confidence = confidence;

  // The Digital Twin is company-level — its unique key is (tenant, company,
  // dimension), and getTwinSummary reads by company. projectId is intentionally
  // NOT written: it isn't in the key, so writing it would let one project's
  // dimension overwrite another's row and leave projectId pointing at the wrong one.
  await db
    .insert(digitalTwins)
    .values({
      tenantId: input.tenantId,
      companyId: input.companyId,
      dimension: input.dimension,
      summary: input.summary,
      structured: input.structured,
      confidence,
    })
    .onDuplicateKeyUpdate({ set: updateSet });
}

/** Read the assembled Digital Twin (dimension → summary) for a company. */
export async function getTwinSummary(tenantId: string, companyId: number): Promise<TwinSummary> {
  const db = await getDb();
  if (!db) return {};
  const rows = await db
    .select()
    .from(digitalTwins)
    .where(and(eq(digitalTwins.tenantId, tenantId), eq(digitalTwins.companyId, companyId)));
  const out: TwinSummary = {};
  for (const row of rows) {
    if ((DIMENSION_KEYS as readonly string[]).includes(row.dimension)) {
      out[row.dimension as Dimension] = row.summary;
    }
  }
  return out;
}

/**
 * True if the session exists within (tenant, company). Permissive when there is
 * no DB (dev/test). Used to reject a sessionId the caller doesn't legitimately own.
 */
export async function isSessionInCompany(
  tenantId: string,
  companyId: number,
  sessionId: number,
): Promise<boolean> {
  const db = await getDb();
  if (!db) return true;
  const [row] = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.tenantId, tenantId), eq(sessions.companyId, companyId)))
    .limit(1);
  return !!row;
}

export interface SaveCompletenessInput {
  tenantId: string;
  companyId: number;
  sessionId?: number;
  coverage: DimensionCoverage;
}

/** Insert or update the completeness signal for a (company, session). */
export async function saveCompleteness(input: SaveCompletenessInput): Promise<CompletenessRow> {
  const row = completenessRow(input.coverage);
  const db = await getDb();
  if (!db) return row;

  // Sentinel 0 for the company-level (no-session) row. Writing NULL would never
  // match the unique key (MySQL treats each NULL as distinct) and would duplicate
  // rows; 0 keeps uq_completeness_company_session effective.
  const sid = input.sessionId ?? 0;

  // Atomic upsert keyed on (tenantId, companyId, sessionId) — avoids the
  // select-then-insert race where two concurrent turns both insert and the second
  // violates the unique constraint. Mirrors upsertTwinDimension.
  await db
    .insert(completenessTracking)
    .values({ tenantId: input.tenantId, companyId: input.companyId, sessionId: sid, ...row })
    .onDuplicateKeyUpdate({ set: row });
  return row;
}
