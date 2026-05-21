/**
 * Memory Hygiene Cron — IMPLEMENTATION_PLAN.md Workstream 1.4
 *
 * Nightly maintenance of the memory store. Runs as part of the nightly cron
 * (called from runNightlyTelemetry).
 *
 * Phase 1 scope: exact-duplicate retirement — within each company, memory
 * items whose canonical form is identical (after normalisation) are collapsed
 * to the single highest-effective-confidence item; the rest are retired
 * (invalidAt set, supersededById pointed at the keeper). This is a zero-
 * false-positive safety net for duplicates that slipped past the ingest-time
 * decision (e.g. items written before hybrid dedup, or via direct API writes).
 *
 * Consolidation, near-duplicate merging, and the reflection pass are added to
 * this job in a later step — semantic merges need human review or a higher
 * bar than exact match.
 */

import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "../db";
import { companies, memoryItems } from "../../drizzle/schema";
import { effectiveConfidenceAsOf } from "../memory/decay";
import { appendAudit } from "../middleware/audit";

export interface MemoryHygieneResult {
  companiesProcessed: number;
  duplicatesRetired: number;
  errors: string[];
}

/** Normalise canonical form for exact-duplicate grouping. */
function normalizeKey(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Run nightly memory hygiene across every company.
 * Never throws — per-company failures are collected into `errors`.
 */
export async function runMemoryHygiene(): Promise<MemoryHygieneResult> {
  const db = await getDb();
  if (!db) {
    return { companiesProcessed: 0, duplicatesRetired: 0, errors: ["DB unavailable"] };
  }

  const allCompanies = await db.select().from(companies);
  const errors: string[] = [];
  let duplicatesRetired = 0;

  for (const company of allCompanies) {
    try {
      duplicatesRetired += await dedupeCompany(db, company.tenantId, company.id);
    } catch (err) {
      errors.push(
        `company ${company.id}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return { companiesProcessed: allCompanies.length, duplicatesRetired, errors };
}

/** Retire exact-duplicate memory items within one company. Returns the count retired. */
async function dedupeCompany(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  tenantId: string,
  companyId: number,
): Promise<number> {
  // Currently-valid items only (C19).
  const items = await db
    .select()
    .from(memoryItems)
    .where(
      and(
        eq(memoryItems.tenantId, tenantId),
        eq(memoryItems.companyId, companyId),
        isNull(memoryItems.invalidAt),
      ),
    );

  // Group by normalised canonical form.
  const groups = new Map<string, typeof items>();
  for (const item of items) {
    const key = normalizeKey(item.canonicalForm);
    const group = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
  }

  let retired = 0;
  const now = new Date();

  for (const group of Array.from(groups.values())) {
    if (group.length < 2) continue;

    // Keep the highest effective (decay-adjusted) confidence; retire the rest.
    const ranked = group
      .map((item) => ({
        item,
        eff: effectiveConfidenceAsOf(
          item.confidence ?? 0.5,
          item.decayClass,
          item.ingestedAt,
          now,
        ),
      }))
      .sort((a, b) => b.eff - a.eff);

    const keeper = ranked[0].item;
    for (let i = 1; i < ranked.length; i++) {
      const loser = ranked[i].item;
      await db
        .update(memoryItems)
        .set({ invalidAt: now, supersededById: keeper.id })
        .where(eq(memoryItems.id, loser.id));
      retired += 1;

      void appendAudit({
        tenantId,
        companyId,
        action: "write",
        resourceType: "memory_item",
        resourceId: String(loser.id),
        confidentialityTier: "confidential",
        metadata: { hygiene: "exact-duplicate-retired", keeper: keeper.id },
      });
    }
  }

  return retired;
}
