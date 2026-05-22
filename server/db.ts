import { and, eq, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  tenants,
  companies,
  strategyProjects,
  sessions,
  auditLogs,
  usageEvents,
  llmCallLogs,
  type Company,
  type StrategyProject,
  type Session,
  type User,
  type UserRole,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }

    // Role assignment: GP users get gp role, owner gets admin
    if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    } else if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    }

    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

/** List every user in a tenant, newest sign-in first. */
export async function listUsers(tenantId: string): Promise<User[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(users)
    .where(eq(users.tenantId, tenantId))
    .orderBy(users.lastSignedIn);
}

/** Update a user's role. Tenant-scoped (C1). */
export async function updateUserRole(
  tenantId: string,
  userId: number,
  role: UserRole,
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(users)
    .set({ role })
    .where(and(eq(users.tenantId, tenantId), eq(users.id, userId)));
}

/**
 * Set the companies a user may access. Pass null to clear scoping (the user
 * then sees every company, subject to their role). Tenant-scoped (C1).
 */
export async function setAssignedCompanies(
  tenantId: string,
  userId: number,
  companyIds: number[] | null,
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(users)
    .set({ assignedCompanyIds: companyIds })
    .where(and(eq(users.tenantId, tenantId), eq(users.id, userId)));
}

// ─── Tenants ──────────────────────────────────────────────────────────────────

export async function ensureDefaultTenant(): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .insert(tenants)
    .values({ id: "gp1", name: "GP Fund I" })
    .onDuplicateKeyUpdate({ set: { name: "GP Fund I" } });
}

// ─── Companies ────────────────────────────────────────────────────────────────

export async function listCompanies(tenantId: string): Promise<Company[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select()
    .from(companies)
    .where(and(eq(companies.tenantId, tenantId), isNull(companies.deletedAt)));
  // Hide reserved memory-layer containers (__global__, __user__) from the
  // company switcher — they are memory scopes, not portfolio companies.
  return rows.filter((c) => !(c.name.startsWith("__") && c.name.endsWith("__")));
}

export async function getCompany(tenantId: string, companyId: number): Promise<Company | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const [row] = await db
    .select()
    .from(companies)
    .where(and(eq(companies.tenantId, tenantId), eq(companies.id, companyId)))
    .limit(1);
  return row;
}

export async function createCompany(params: {
  tenantId: string;
  name: string;
  industry?: string;
  description?: string;
}): Promise<Company> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [inserted] = await db.insert(companies).values(params).$returningId();
  const [row] = await db.select().from(companies).where(eq(companies.id, inserted.id)).limit(1);
  return row;
}

// ─── Strategy Projects ────────────────────────────────────────────────────────

export async function listProjects(tenantId: string, companyId: number): Promise<StrategyProject[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(strategyProjects)
    .where(
      and(
        eq(strategyProjects.tenantId, tenantId),
        eq(strategyProjects.companyId, companyId),
        isNull(strategyProjects.deletedAt)
      )
    );
}

export async function createProject(params: {
  tenantId: string;
  companyId: number;
  name: string;
  description?: string;
}): Promise<StrategyProject> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [inserted] = await db.insert(strategyProjects).values(params).$returningId();
  const [row] = await db.select().from(strategyProjects).where(eq(strategyProjects.id, inserted.id)).limit(1);
  return row;
}

// ─── Sessions ─────────────────────────────────────────────────────────────────

export async function createSession(params: {
  tenantId: string;
  companyId: number;
  projectId: number;
  userId: number;
  title?: string;
}): Promise<Session> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [inserted] = await db.insert(sessions).values(params).$returningId();
  const [row] = await db.select().from(sessions).where(eq(sessions.id, inserted.id)).limit(1);
  return row;
}

export async function listSessions(tenantId: string, companyId: number, projectId: number): Promise<Session[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(sessions)
    .where(
      and(
        eq(sessions.tenantId, tenantId),
        eq(sessions.companyId, companyId),
        eq(sessions.projectId, projectId)
      )
    );
}

// ─── Audit + Usage queries ────────────────────────────────────────────────────

export async function queryAuditLogs(params: {
  tenantId: string;
  companyId?: number;
  limit?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(auditLogs.tenantId, params.tenantId)];
  if (params.companyId) conditions.push(eq(auditLogs.companyId, params.companyId));
  return db
    .select()
    .from(auditLogs)
    .where(and(...conditions))
    .limit(params.limit ?? 50)
    .orderBy(auditLogs.createdAt);
}

export async function queryUsageEvents(params: {
  tenantId: string;
  companyId?: number;
  action?: string;
  limit?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(usageEvents.tenantId, params.tenantId)];
  if (params.companyId) conditions.push(eq(usageEvents.companyId, params.companyId));
  if (params.action) conditions.push(eq(usageEvents.action, params.action));
  return db
    .select()
    .from(usageEvents)
    .where(and(...conditions))
    .limit(params.limit ?? 50)
    .orderBy(usageEvents.createdAt);
}

// ─── LLM Cost queries ─────────────────────────────────────────────────────────

export async function queryCostByUser(tenantId: string, userId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(llmCallLogs)
    .where(and(eq(llmCallLogs.tenantId, tenantId), eq(llmCallLogs.userId, userId)))
    .limit(limit)
    .orderBy(llmCallLogs.createdAt);
}

export async function queryCostByCompany(tenantId: string, companyId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(llmCallLogs)
    .where(and(eq(llmCallLogs.tenantId, tenantId), eq(llmCallLogs.companyId, companyId)))
    .limit(limit)
    .orderBy(llmCallLogs.createdAt);
}
