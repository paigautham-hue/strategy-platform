/**
 * Calibration snapshot cron — Phase 6 learning loop.
 *
 * Walks every company, joins its closed predictions to outcomes, and computes the
 * real-world calibration scorecard. Returns a per-company snapshot (Brier, hit
 * rate, scored count) so the scheduler's response captures a time series of how
 * well-calibrated the platform is as real outcomes accumulate. Read-only — it does
 * not invent outcomes (those are recorded by resolvePrediction).
 */

import { getDb } from "../db";
import { companies } from "../../drizzle/schema";
import { getCalibrationRecords, computeScorecard } from "../services/calibration";

export interface CalibrationSnapshotRow {
  tenantId: string;
  companyId: number;
  name: string;
  brier: number;
  hitRate: number;
  reliability: number;
  resolution: number;
  count: number;
}

export interface CalibrationSnapshotResult {
  companies: number;
  scoredCompanies: number;
  scoredRecords: number;
  snapshots: CalibrationSnapshotRow[];
}

export async function runCalibrationSnapshot(): Promise<CalibrationSnapshotResult> {
  const db = await getDb();
  if (!db) return { companies: 0, scoredCompanies: 0, scoredRecords: 0, snapshots: [] };

  const cos = await db.select().from(companies);
  const snapshots: CalibrationSnapshotRow[] = [];
  let scoredRecords = 0;

  for (const c of cos) {
    const records = await getCalibrationRecords({ tenantId: c.tenantId, companyId: c.id });
    const sc = computeScorecard(records);
    if (sc.real.count > 0) {
      scoredRecords += sc.real.count;
      snapshots.push({
        tenantId: c.tenantId,
        companyId: c.id,
        name: c.name,
        brier: sc.real.brier,
        hitRate: sc.real.hitRate,
        reliability: sc.real.reliability,
        resolution: sc.real.resolution,
        count: sc.real.count,
      });
    }
  }

  return {
    companies: cos.length,
    scoredCompanies: snapshots.length,
    scoredRecords,
    snapshots,
  };
}
