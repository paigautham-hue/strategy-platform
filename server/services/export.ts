/**
 * Export service — P10, Workstream 0.5
 *
 * Per-portco encrypted archive export.
 * Stores archive in Manus file storage.
 * Returns signed download URL.
 */

import { eq, and } from "drizzle-orm";
import { getDb } from "../db";
import {
  exportJobs,
  memoryItems,
  predictions,
  decisions,
  sessions,
  strategyProjects,
  companies,
  type ExportJob,
} from "../../drizzle/schema";
import { storagePut, storageGetSignedUrl } from "../storage";
import { appendAudit } from "../middleware/audit";
import { nanoid } from "nanoid";
import { createHash } from "crypto";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ExportRequest {
  tenantId: string;
  companyId: number;
  requestedBy: number;
  traceId?: string;
}

export interface ExportResult {
  jobId: number;
  downloadUrl: string;
  expiresAt: Date;
}

// ─── create_export ────────────────────────────────────────────────────────────

/**
 * Create a per-portco encrypted archive export.
 * Collects all company data, serializes to JSON, applies a simple
 * deterministic encryption (XOR with SHA-256 key), stores in S3,
 * and returns a signed download URL.
 */
export async function createExport(input: ExportRequest): Promise<ExportResult> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Create pending job
  const [inserted] = await db.insert(exportJobs).values({
    tenantId: input.tenantId,
    companyId: input.companyId,
    requestedBy: input.requestedBy,
    status: "processing",
  }).$returningId();

  const jobId = inserted.id;

  try {
    // Collect all company data (C1: scoped to this company only)
    const [companyRow] = await db
      .select()
      .from(companies)
      .where(
        and(
          eq(companies.tenantId, input.tenantId),
          eq(companies.id, input.companyId)
        )
      )
      .limit(1);

    const [projectRows, sessionRows, memoryRows, predictionRows, decisionRows] = await Promise.all([
      db.select().from(strategyProjects).where(
        and(eq(strategyProjects.tenantId, input.tenantId), eq(strategyProjects.companyId, input.companyId))
      ),
      db.select().from(sessions).where(
        and(eq(sessions.tenantId, input.tenantId), eq(sessions.companyId, input.companyId))
      ),
      db.select().from(memoryItems).where(
        and(eq(memoryItems.tenantId, input.tenantId), eq(memoryItems.companyId, input.companyId))
      ),
      db.select().from(predictions).where(
        and(eq(predictions.tenantId, input.tenantId), eq(predictions.companyId, input.companyId))
      ),
      db.select().from(decisions).where(
        and(eq(decisions.tenantId, input.tenantId), eq(decisions.companyId, input.companyId))
      ),
    ]);

    const archive = {
      exportedAt: new Date().toISOString(),
      tenantId: input.tenantId,
      companyId: input.companyId,
      company: companyRow,
      projects: projectRows,
      sessions: sessionRows,
      memories: memoryRows.map((m) => ({ ...m, embedding: undefined })), // strip embeddings
      predictions: predictionRows,
      decisions: decisionRows,
    };

    const plaintext = JSON.stringify(archive, null, 2);

    // Simple encryption: XOR with repeating SHA-256 key
    // Phase 1: replace with AES-256-GCM using per-company KMS key
    const encryptionKey = process.env.JWT_SECRET ?? "default-phase0-key";
    const keyHash = createHash("sha256").update(encryptionKey + input.companyId).digest();
    const plaintextBuf = Buffer.from(plaintext, "utf-8");
    const encrypted = Buffer.alloc(plaintextBuf.length);
    for (let i = 0; i < plaintextBuf.length; i++) {
      encrypted[i] = plaintextBuf[i] ^ keyHash[i % keyHash.length];
    }

    // Store in Manus file storage
    const storageKey = `exports/${input.tenantId}/${input.companyId}/${nanoid(16)}.enc`;
    const { key: savedKey } = await storagePut(storageKey, encrypted, "application/octet-stream");

    // Get a true signed download URL (presigned GET, not the internal /manus-storage/ path)
    const signedUrl = await storageGetSignedUrl(savedKey);

    // Set expiry to 24 hours from now
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Update job as complete
    await db
      .update(exportJobs)
      .set({
        status: "complete",
        storageKey: savedKey,
        downloadUrl: signedUrl,
        expiresAt,
      })
      .where(eq(exportJobs.id, jobId));

    // Audit the export
    void appendAudit({
      tenantId: input.tenantId,
      companyId: input.companyId,
      userId: input.requestedBy,
      action: "export",
      resourceType: "export_job",
      resourceId: String(jobId),
      confidentialityTier: "restricted",
      traceId: input.traceId,
      metadata: {
        memoryCount: memoryRows.length,
        predictionCount: predictionRows.length,
        storageKey: savedKey,
      },
    });

    return { jobId, downloadUrl: signedUrl, expiresAt };
  } catch (err) {
    // Mark job as failed
    await db
      .update(exportJobs)
      .set({
        status: "failed",
        errorMessage: err instanceof Error ? err.message : String(err),
      })
      .where(eq(exportJobs.id, jobId));
    throw err;
  }
}

// ─── get_export_job ───────────────────────────────────────────────────────────

export async function getExportJob(
  jobId: number,
  tenantId: string,
  companyId: number
): Promise<ExportJob | null> {
  const db = await getDb();
  if (!db) return null;

  const [row] = await db
    .select()
    .from(exportJobs)
    .where(
      and(
        eq(exportJobs.id, jobId),
        eq(exportJobs.tenantId, tenantId),
        eq(exportJobs.companyId, companyId)
      )
    )
    .limit(1);

  return row ?? null;
}

// ─── daily_backup ─────────────────────────────────────────────────────────────

/**
 * Daily backup: export all companies in the tenant.
 * Called by the backup cron job.
 */
export async function runDailyBackup(tenantId: string): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const allCompanies = await db
    .select({ id: companies.id })
    .from(companies)
    .where(eq(companies.tenantId, tenantId));

  console.log(`[backup] Starting daily backup for ${allCompanies.length} companies in tenant ${tenantId}`);

  for (const company of allCompanies) {
    try {
      await createExport({
        tenantId,
        companyId: company.id,
        requestedBy: -1, // system
      });
      console.log(`[backup] Company ${company.id} backed up successfully`);
    } catch (err) {
      console.error(`[backup] Failed to back up company ${company.id}:`, err);
    }
  }

  console.log(`[backup] Daily backup complete for tenant ${tenantId}`);
}
