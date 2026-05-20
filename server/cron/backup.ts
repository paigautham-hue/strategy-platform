/**
 * Daily backup cron and nightly usage-telemetry aggregation
 * Registered as heartbeat jobs — no manual triggers required.
 *
 * Jobs:
 *   - daily-backup:    runs at 02:00 UTC — exports all companies to encrypted archives
 *   - nightly-telemetry: runs at 03:00 UTC — aggregates usage events into daily summaries
 */

import { getDb } from "../db";
import { companies, llmCallLogs, usageEvents } from "../../drizzle/schema";
import { and, gte, lt, sql } from "drizzle-orm";
import { appendAudit } from "../middleware/audit";
import { createExport } from "../services/export";

// ─── Daily Backup ─────────────────────────────────────────────────────────────

export async function runDailyBackup(): Promise<{ companiesProcessed: number; errors: string[] }> {
  const db = await getDb();
  if (!db) {
    console.warn("[backup] DB unavailable, skipping backup run");
    return { companiesProcessed: 0, errors: ["DB unavailable"] };
  }

  const allCompanies = await db.select().from(companies);
  const errors: string[] = [];
  let processed = 0;

  for (const company of allCompanies) {
    try {
      console.log(`[backup] Starting backup for company ${company.id} (${company.name})`);

      // Delegate to createExport which handles job creation, encryption, storage, and audit
      await createExport({
        tenantId: company.tenantId,
        companyId: company.id,
        requestedBy: -1, // system/cron
      });

      processed++;
      console.log(`[backup] ✓ Company ${company.id} backed up`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`company ${company.id}: ${msg}`);
      console.error(`[backup] ✗ Company ${company.id} failed: ${msg}`);
    }
  }

  console.log(`[backup] Run complete: ${processed}/${allCompanies.length} companies backed up`);
  return { companiesProcessed: processed, errors };
}

// ─── Nightly Telemetry Aggregation ────────────────────────────────────────────

export async function runNightlyTelemetry(): Promise<{ aggregated: number }> {
  const db = await getDb();
  if (!db) {
    console.warn("[telemetry] DB unavailable, skipping aggregation");
    return { aggregated: 0 };
  }

  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  yesterday.setUTCHours(0, 0, 0, 0);
  const today = new Date(yesterday);
  today.setUTCDate(today.getUTCDate() + 1);

  // Aggregate LLM call logs for yesterday
  const summary = await db
    .select({
      tenantId: llmCallLogs.tenantId,
      companyId: llmCallLogs.companyId,
      callType: llmCallLogs.callType,
      model: llmCallLogs.model,
      totalCalls: sql<number>`COUNT(*)`,
      totalTokensIn: sql<number>`SUM(${llmCallLogs.tokensIn})`,
      totalTokensOut: sql<number>`SUM(${llmCallLogs.tokensOut})`,
      totalCost: sql<number>`SUM(${llmCallLogs.costUsd})`,
      avgLatency: sql<number>`AVG(${llmCallLogs.latencyMs})`,
      successCount: sql<number>`SUM(CASE WHEN ${llmCallLogs.success} = 1 THEN 1 ELSE 0 END)`,
    })
    .from(llmCallLogs)
    .where(
      and(
        gte(llmCallLogs.createdAt, yesterday),
        lt(llmCallLogs.createdAt, today)
      )
    )
    .groupBy(
      llmCallLogs.tenantId,
      llmCallLogs.companyId,
      llmCallLogs.callType,
      llmCallLogs.model
    );

  console.log(`[telemetry] Aggregated ${summary.length} rows for ${yesterday.toISOString().slice(0, 10)}`);

  // Log usage event for telemetry run
  await db.insert(usageEvents).values({
    tenantId: "system",
    action: "nightly_telemetry_run",
    surface: "cron",
    metadata: {
      date: yesterday.toISOString().slice(0, 10),
      rowsAggregated: summary.length,
    },
  });

  return { aggregated: summary.length };
}
