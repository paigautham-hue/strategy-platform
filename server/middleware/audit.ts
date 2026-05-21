/**
 * Audit log + usage event middleware — P5, P6
 *
 * append_audit(): append-only entry on every confidential data read/write.
 * emit_usage(): emit usage events on every UI action.
 * Both are fire-and-forget (non-blocking) to avoid slowing down the request path.
 */

import { getDb } from "../db";
import { auditLogs, usageEvents, type UserRole } from "../../drizzle/schema";

// ─── Audit Log ────────────────────────────────────────────────────────────────

export interface AuditEntry {
  tenantId: string;
  companyId?: number;
  projectId?: number;
  sessionId?: number;
  userId?: number;
  action: string;
  resourceType: string;
  resourceId?: string;
  confidentialityTier?: "standard" | "confidential" | "restricted";
  ipAddress?: string;
  userAgent?: string;
  traceId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Append an audit log entry. Append-only — no update or delete path.
 * Non-blocking: errors are logged but do not throw.
 */
export async function appendAudit(entry: AuditEntry): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;

    await db.insert(auditLogs).values({
      tenantId: entry.tenantId,
      companyId: entry.companyId,
      projectId: entry.projectId,
      sessionId: entry.sessionId,
      userId: entry.userId,
      action: entry.action,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId,
      confidentialityTier: entry.confidentialityTier ?? "standard",
      ipAddress: entry.ipAddress,
      userAgent: entry.userAgent,
      traceId: entry.traceId,
      metadata: entry.metadata,
    });
  } catch (err) {
    // Audit failures must never break the main request
    console.error("[audit] Failed to write audit entry:", err);
  }
}

// ─── Usage Event Log ──────────────────────────────────────────────────────────

export interface UsageEventEntry {
  tenantId: string;
  companyId?: number;
  projectId?: number;
  sessionId?: number;
  userId?: number;
  role?: UserRole;
  surface: string;
  action: string;
  metadata?: Record<string, unknown>;
}

/**
 * Emit a usage event. Append-only — no update or delete path.
 * Non-blocking: errors are logged but do not throw.
 *
 * Required events: create-project, write-memory, run-llm
 */
export async function emitUsage(entry: UsageEventEntry): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;

    await db.insert(usageEvents).values({
      tenantId: entry.tenantId,
      companyId: entry.companyId,
      projectId: entry.projectId,
      sessionId: entry.sessionId,
      userId: entry.userId,
      role: entry.role,
      surface: entry.surface,
      action: entry.action,
      metadata: entry.metadata,
    });
  } catch (err) {
    console.error("[usage] Failed to write usage event:", err);
  }
}

// ─── Convenience wrappers ─────────────────────────────────────────────────────

/** Audit a confidential memory read. */
export function auditMemoryRead(params: {
  tenantId: string;
  companyId: number;
  userId?: number;
  resourceId?: string;
  traceId?: string;
}) {
  return appendAudit({
    ...params,
    action: "read",
    resourceType: "memory_item",
    confidentialityTier: "confidential",
  });
}

/** Audit a memory write. */
export function auditMemoryWrite(params: {
  tenantId: string;
  companyId: number;
  userId?: number;
  resourceId?: string;
  traceId?: string;
}) {
  return appendAudit({
    ...params,
    action: "write",
    resourceType: "memory_item",
    confidentialityTier: "confidential",
  });
}

/** Audit a prediction ledger write. */
export function auditPredictionWrite(params: {
  tenantId: string;
  companyId: number;
  userId?: number;
  resourceId?: string;
  traceId?: string;
}) {
  return appendAudit({
    ...params,
    action: "write",
    resourceType: "prediction",
    confidentialityTier: "confidential",
  });
}

/**
 * Audit a deliberate cross-company read (Workstream 3.6). The platform is
 * company-namespaced by default (C1); a cross-company war-game is the rare
 * exception, so every company touched gets its own restricted-tier entry.
 */
export function auditCrossCompanyRead(params: {
  tenantId: string;
  companyId: number;
  userId?: number;
  resourceId?: string;
  traceId?: string;
  metadata?: Record<string, unknown>;
}) {
  return appendAudit({
    ...params,
    action: "cross-company-read",
    resourceType: "cross_co_war_game",
    confidentialityTier: "restricted",
  });
}

/** Audit an export request. */
export function auditExport(params: {
  tenantId: string;
  companyId: number;
  userId?: number;
  resourceId?: string;
  traceId?: string;
}) {
  return appendAudit({
    ...params,
    action: "export",
    resourceType: "export_job",
    confidentialityTier: "restricted",
  });
}
