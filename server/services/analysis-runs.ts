/**
 * Analysis run persistence — saved AI outputs.
 *
 * Reasoning-surface results (diagnosis, research, war-game, …) used to live
 * only in client mutation state and evaporated on navigation. Every run is
 * now saved (best-effort — a storage failure never blocks the result) and
 * listable per company for history views and document export. C1-namespaced.
 */

import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../db";
import { analysisRuns, type AnalysisRun, analysisKindEnum } from "../../drizzle/schema";

export type AnalysisKind = (typeof analysisKindEnum)[number];

const INPUT_SUMMARY_MAX = 512;

export interface SaveAnalysisRunParams {
  tenantId: string;
  companyId: number;
  projectId?: number;
  kind: AnalysisKind;
  inputSummary: string;
  result: Record<string, unknown>;
  model?: string;
  costUsd?: number;
  createdBy?: number;
}

/**
 * Persist a run. Best-effort: logs and swallows failures so the agent result
 * always reaches the user even if the history write fails.
 */
export async function saveAnalysisRun(params: SaveAnalysisRunParams): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    await db.insert(analysisRuns).values({
      tenantId: params.tenantId,
      companyId: params.companyId,
      projectId: params.projectId,
      kind: params.kind,
      inputSummary: params.inputSummary.slice(0, INPUT_SUMMARY_MAX),
      result: params.result,
      model: params.model,
      costUsd: params.costUsd,
      createdBy: params.createdBy,
    });
  } catch (err) {
    console.error("[analysis-runs] Failed to save run:", err);
  }
}

/** List runs for a company, newest first. Optionally filter by kind. */
export async function listAnalysisRuns(
  tenantId: string,
  companyId: number,
  opts?: { kind?: AnalysisKind; limit?: number }
): Promise<AnalysisRun[]> {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(analysisRuns.tenantId, tenantId), eq(analysisRuns.companyId, companyId)];
  if (opts?.kind) conditions.push(eq(analysisRuns.kind, opts.kind));
  return db
    .select()
    .from(analysisRuns)
    .where(and(...conditions))
    .orderBy(desc(analysisRuns.createdAt))
    .limit(Math.min(opts?.limit ?? 50, 200));
}

/** Fetch a single run, tenant-scoped (C1 — never by id alone). */
export async function getAnalysisRun(tenantId: string, id: number): Promise<AnalysisRun | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(analysisRuns)
    .where(and(eq(analysisRuns.id, id), eq(analysisRuns.tenantId, tenantId)))
    .limit(1);
  return rows[0] ?? null;
}
