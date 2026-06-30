/**
 * Portfolio overview — cross-company learning view (Phase 7, GP-only).
 *
 * Aggregates the prediction ledger + calibration scorecard across every company
 * in the tenant, so the GP can see, at a glance, where the platform is making
 * (and closing) predictions and how well-calibrated each company's record is.
 *
 * This is the data-dependent surface: counts and calibration fill in as real
 * predictions are recorded and resolved (see resolvePrediction). It is GP-only
 * because it deliberately reads across the company boundary — callers must enforce
 * the GP/admin gate (the router does, via gpProcedure).
 */

import { eq, and, isNull } from "drizzle-orm";
import { getDb } from "../db";
import { companies, predictions } from "../../drizzle/schema";
import { getCalibrationRecords, computeScorecard } from "./calibration";

export interface PortfolioCompanyRow {
  companyId: number;
  name: string;
  industry: string | null;
  totalPredictions: number;
  closedPredictions: number;
  openPredictions: number;
  /** Real-world calibration — null until at least one real prediction is scored. */
  realBrier: number | null;
  realHitRate: number | null;
  realScored: number;
}

export interface PortfolioOverview {
  companies: PortfolioCompanyRow[];
  totals: {
    companies: number;
    totalPredictions: number;
    closedPredictions: number;
    openPredictions: number;
    scoredReal: number;
  };
}

export async function portfolioOverview(tenantId: string): Promise<PortfolioOverview> {
  const empty: PortfolioOverview = {
    companies: [],
    totals: { companies: 0, totalPredictions: 0, closedPredictions: 0, openPredictions: 0, scoredReal: 0 },
  };
  const db = await getDb();
  if (!db) return empty;

  const cos = await db
    .select()
    .from(companies)
    .where(and(eq(companies.tenantId, tenantId), isNull(companies.deletedAt)));

  const rows: PortfolioCompanyRow[] = [];
  for (const c of cos) {
    const preds = await db
      .select({ id: predictions.id, outcomeId: predictions.outcomeId })
      .from(predictions)
      .where(and(eq(predictions.tenantId, tenantId), eq(predictions.companyId, c.id)));
    const total = preds.length;
    const closed = preds.filter((p) => p.outcomeId != null).length;

    const records = await getCalibrationRecords({ tenantId, companyId: c.id });
    const scorecard = computeScorecard(records);
    const scored = scorecard.real.count;

    rows.push({
      companyId: c.id,
      name: c.name,
      industry: c.industry ?? null,
      totalPredictions: total,
      closedPredictions: closed,
      openPredictions: total - closed,
      realBrier: scored > 0 ? scorecard.real.brier : null,
      realHitRate: scored > 0 ? scorecard.real.hitRate : null,
      realScored: scored,
    });
  }

  rows.sort((a, b) => b.totalPredictions - a.totalPredictions);

  return {
    companies: rows,
    totals: {
      companies: rows.length,
      totalPredictions: rows.reduce((s, r) => s + r.totalPredictions, 0),
      closedPredictions: rows.reduce((s, r) => s + r.closedPredictions, 0),
      openPredictions: rows.reduce((s, r) => s + r.openPredictions, 0),
      scoredReal: rows.reduce((s, r) => s + r.realScored, 0),
    },
  };
}
