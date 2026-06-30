/**
 * Strategic Management — structured-output auto-write (salvaged from StrategyForge)
 * IMPLEMENTATION_PLAN.md Phase 5
 *
 * The salvaged pattern: an LLM returns JSON-schema-validated KPIs / milestones /
 * risks, which are normalised and written straight into the strategy project's
 * data model. This module holds the PURE normalisers (category mapping, risk
 * scoring, defaulting — all unit-tested) plus thin, tenant-scoped (C1) DB writers
 * and readers. The LLM generation itself lives in `server/agents/strategic-extract.ts`
 * and routes through the router (C3).
 */

import { eq, and, desc } from "drizzle-orm";
import { getDb } from "../db";
import {
  strategyProjects,
  strategyKpis,
  strategyMilestones,
  strategyRisks,
  type StrategyKpi,
  type StrategyMilestone,
  type StrategyRisk,
  type StrategyKpiCategory,
  type StrategyKpiStatus,
  type StrategyMilestoneStatus,
  kpiCategoryEnum,
  kpiStatusEnum,
  milestoneStatusEnum,
} from "../../drizzle/schema";

// ─────────────────────────────────────────────────────────────────────────────
// PURE NORMALISERS (unit-tested)
// ─────────────────────────────────────────────────────────────────────────────

export interface NormalizedKpi {
  label: string;
  target: number | null;
  current: number | null;
  unit: string | null;
  category: StrategyKpiCategory;
  status: StrategyKpiStatus;
}
export interface NormalizedMilestone {
  title: string;
  description: string | null;
  quarter: string | null;
  fiscalYear: string | null;
  status: StrategyMilestoneStatus;
}
export interface NormalizedRisk {
  title: string;
  description: string | null;
  probability: number;
  impact: number;
  riskScore: number;
  mitigation: string | null;
}
export interface NormalizedStrategicItems {
  kpis: NormalizedKpi[];
  milestones: NormalizedMilestone[];
  risks: NormalizedRisk[];
}

const MAX_ITEMS = 20;

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" && v.trim() ? v.trim() : fallback;
}
function strOrNull(v: unknown): string | null {
  const s = str(v);
  return s ? s : null;
}
/** Coerce a number or a numeric string to a finite number; otherwise null. */
function toNum(v: unknown): number | null {
  if (typeof v === "string") {
    const s = v.trim();
    if (s === "") return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
function numOrNull(v: unknown): number | null {
  // The strategy schema is strict:false, so the LLM may emit "200" for a number.
  return toNum(v);
}
function clamp0to100(v: unknown): number {
  const n = toNum(v) ?? 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/**
 * Map a free-text category label onto the KPI category enum. Mirrors the
 * StrategyForge mapping (efficiency/technical → operational, competitive → market).
 * Pure.
 */
export function mapKpiCategory(raw: unknown): StrategyKpiCategory {
  const s = str(raw).toLowerCase();
  if (/financ|revenue|cost|margin|cash|budget|profit|ebitda/.test(s)) return "financial";
  if (/market|growth|customer|competit|sales|brand|demand/.test(s)) return "market";
  if (/organi[sz]|people|talent|team|culture|\bhr\b|hiring|headcount/.test(s)) return "organizational";
  // efficiency, operational, technical, technology, process, quality → operational
  return "operational";
}

// Common LLM phrasings → canonical enum (the schema is strict:false, so free text is expected).
const KPI_STATUS_ALIASES: Record<string, StrategyKpiStatus> = {
  ontarget: "on-track", "on-target": "on-track", ontrack: "on-track", green: "on-track", healthy: "on-track", good: "on-track",
  amber: "at-risk", yellow: "at-risk", warning: "at-risk", risk: "at-risk", atrisk: "at-risk",
  red: "off-track", behind: "off-track", failing: "off-track", offtrack: "off-track",
};
const MILESTONE_STATUS_ALIASES: Record<string, StrategyMilestoneStatus> = {
  complete: "done", completed: "done", finished: "done", shipped: "done", delivered: "done",
  ongoing: "in-progress", "in-flight": "in-progress", started: "in-progress", active: "in-progress",
  behind: "missed", delayed: "missed", late: "missed", slipped: "missed",
  "not-started": "planned", todo: "planned", upcoming: "planned",
};

/** Normalise a status: lowercase, collapse any non-letter run to '-', trim edge hyphens. */
function normStatus(raw: unknown): string {
  return str(raw).toLowerCase().replace(/[^a-z]+/g, "-").replace(/^-+|-+$/g, "");
}

/**
 * Resolve a normalised status against an enum + alias map, in order: exact enum,
 * enum as a PREFIX ("on-track-for-q2" → "on-track"), exact alias, then each token
 * against the enum/alias (so "behind schedule" / "high risk" / "in progress, on
 * schedule" still classify). Falls back to `fallback`.
 */
function resolveStatus<T extends string>(
  s: string,
  enumSet: readonly string[],
  aliases: Record<string, T>,
  fallback: T,
): T {
  if (!s) return fallback;
  if (enumSet.includes(s)) return s as T;
  const prefix = enumSet.find((e) => s === e || s.startsWith(`${e}-`));
  if (prefix) return prefix as T;
  if (aliases[s]) return aliases[s];
  const tokens = s.split("-");
  // A negated "not ... start(ed)" must resolve BEFORE the bare "started" token
  // alias wins (e.g. "not yet started" must be planned, not in-progress).
  if (aliases["not-started"] && tokens.includes("not") && tokens.some((t) => t.startsWith("start"))) {
    return aliases["not-started"];
  }
  for (const tok of tokens) {
    if (enumSet.includes(tok)) return tok as T;
    if (aliases[tok]) return aliases[tok];
  }
  return fallback;
}

function mapKpiStatus(raw: unknown): StrategyKpiStatus {
  return resolveStatus(normStatus(raw), kpiStatusEnum, KPI_STATUS_ALIASES, "unknown");
}

function mapMilestoneStatus(raw: unknown): StrategyMilestoneStatus {
  return resolveStatus(normStatus(raw), milestoneStatusEnum, MILESTONE_STATUS_ALIASES, "planned");
}

/** probability × impact ÷ 100, each clamped to 0–100. Pure. */
export function computeRiskScore(probability: number, impact: number): number {
  return Math.round((clamp0to100(probability) * clamp0to100(impact)) / 100);
}

export function normalizeKpi(raw: unknown): NormalizedKpi {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    label: str(o.label),
    target: numOrNull(o.target),
    current: numOrNull(o.current),
    unit: strOrNull(o.unit),
    category: mapKpiCategory(o.category),
    status: mapKpiStatus(o.status),
  };
}

export function normalizeMilestone(raw: unknown): NormalizedMilestone {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    title: str(o.title),
    description: strOrNull(o.description),
    quarter: strOrNull(o.quarter),
    fiscalYear: strOrNull(o.fiscalYear),
    status: mapMilestoneStatus(o.status),
  };
}

export function normalizeRisk(raw: unknown): NormalizedRisk {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const probability = clamp0to100(o.probability);
  const impact = clamp0to100(o.impact);
  return {
    title: str(o.title),
    description: strOrNull(o.description),
    probability,
    impact,
    riskScore: computeRiskScore(probability, impact),
    mitigation: strOrNull(o.mitigation),
  };
}

/** Normalise a raw LLM payload into validated strategic items. Drops untitled rows. Pure. */
export function normalizeStrategicItems(raw: unknown): NormalizedStrategicItems {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  // Slice AFTER the label/title filter so valid rows past index N aren't dropped in
  // favour of earlier objects that fail validation.
  const arr = (v: unknown): Record<string, unknown>[] =>
    Array.isArray(v) ? (v.filter((x) => x && typeof x === "object") as Record<string, unknown>[]) : [];
  return {
    kpis: arr(o.kpis).map(normalizeKpi).filter((k) => k.label).slice(0, MAX_ITEMS),
    milestones: arr(o.milestones).map(normalizeMilestone).filter((m) => m.title).slice(0, MAX_ITEMS),
    risks: arr(o.risks).map(normalizeRisk).filter((r) => r.title).slice(0, MAX_ITEMS),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// DB WRITERS / READERS (C1 — tenant-scoped)
// ─────────────────────────────────────────────────────────────────────────────

export interface StrategyScope {
  tenantId: string;
  companyId: number;
  projectId?: number;
}

export interface WriteResult {
  kpis: number;
  milestones: number;
  risks: number;
}

/**
 * True if the project exists within (tenant, company). Permissive when there is
 * no DB (dev/test). Used to reject a projectId the caller doesn't legitimately own.
 */
export async function isProjectInCompany(
  tenantId: string,
  companyId: number,
  projectId: number,
): Promise<boolean> {
  const db = await getDb();
  if (!db) return true;
  const [row] = await db
    .select({ id: strategyProjects.id })
    .from(strategyProjects)
    .where(
      and(
        eq(strategyProjects.id, projectId),
        eq(strategyProjects.tenantId, tenantId),
        eq(strategyProjects.companyId, companyId),
      ),
    )
    .limit(1);
  return !!row;
}

/** Insert normalised strategic items for a project. No-op (zeros) when no DB. */
export async function writeStrategicItems(
  scope: StrategyScope,
  items: NormalizedStrategicItems,
): Promise<WriteResult> {
  const db = await getDb();
  if (!db) return { kpis: 0, milestones: 0, risks: 0 };

  const base = { tenantId: scope.tenantId, companyId: scope.companyId, projectId: scope.projectId };

  if (items.kpis.length) {
    await db.insert(strategyKpis).values(items.kpis.map((k) => ({ ...base, ...k })));
  }
  if (items.milestones.length) {
    await db.insert(strategyMilestones).values(items.milestones.map((m) => ({ ...base, ...m })));
  }
  if (items.risks.length) {
    await db.insert(strategyRisks).values(items.risks.map((r) => ({ ...base, ...r })));
  }
  return { kpis: items.kpis.length, milestones: items.milestones.length, risks: items.risks.length };
}

function scopeWhere(table: typeof strategyKpis | typeof strategyMilestones | typeof strategyRisks, scope: StrategyScope) {
  const clauses = [eq(table.tenantId, scope.tenantId), eq(table.companyId, scope.companyId)];
  if (scope.projectId !== undefined) clauses.push(eq(table.projectId, scope.projectId));
  return and(...clauses);
}

export async function listKpis(scope: StrategyScope): Promise<StrategyKpi[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(strategyKpis).where(scopeWhere(strategyKpis, scope)).orderBy(desc(strategyKpis.createdAt));
}

export async function listMilestones(scope: StrategyScope): Promise<StrategyMilestone[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(strategyMilestones).where(scopeWhere(strategyMilestones, scope)).orderBy(desc(strategyMilestones.createdAt));
}

export async function listRisks(scope: StrategyScope): Promise<StrategyRisk[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(strategyRisks).where(scopeWhere(strategyRisks, scope)).orderBy(desc(strategyRisks.riskScore));
}
