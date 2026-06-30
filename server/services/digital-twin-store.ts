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
import { digitalTwins, completenessTracking } from "../../drizzle/schema";
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
  projectId?: number;
  dimension: Dimension;
  summary: string;
  structured?: Record<string, unknown>;
  confidence?: number;
}

/** Upsert one captured dimension of a company's Digital Twin. */
export async function upsertTwinDimension(input: UpsertDimensionInput): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const confidence = Math.max(0, Math.min(100, Math.round(input.confidence ?? 0)));
  await db
    .insert(digitalTwins)
    .values({
      tenantId: input.tenantId,
      companyId: input.companyId,
      projectId: input.projectId,
      dimension: input.dimension,
      summary: input.summary,
      structured: input.structured,
      confidence,
    })
    .onDuplicateKeyUpdate({
      set: { summary: input.summary, structured: input.structured, confidence },
    });
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

  const existing = await db
    .select()
    .from(completenessTracking)
    .where(
      and(
        eq(completenessTracking.tenantId, input.tenantId),
        eq(completenessTracking.companyId, input.companyId),
        input.sessionId === undefined
          ? eq(completenessTracking.sessionId, 0)
          : eq(completenessTracking.sessionId, input.sessionId),
      ),
    )
    .limit(1);

  if (existing.length) {
    await db.update(completenessTracking).set(row).where(eq(completenessTracking.id, existing[0].id));
  } else {
    await db.insert(completenessTracking).values({
      tenantId: input.tenantId,
      companyId: input.companyId,
      sessionId: input.sessionId,
      ...row,
    });
  }
  return row;
}
