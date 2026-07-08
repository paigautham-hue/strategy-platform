import {
  boolean,
  float,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  unique,
  varchar,
} from "drizzle-orm/mysql-core";

// ─────────────────────────────────────────────
// ENUMS
// ─────────────────────────────────────────────

export const userRoleEnum = ["gp", "operator", "portco_team", "admin"] as const;
export type UserRole = (typeof userRoleEnum)[number];

export const claimModalityEnum = ["actual", "hypothetical", "simulated", "counterfactual"] as const;
export type ClaimModality = (typeof claimModalityEnum)[number];

export const decayClassEnum = ["permanent", "slow", "fast", "ephemeral"] as const;
export type DecayClass = (typeof decayClassEnum)[number];

export const visibilityEnum = ["company", "portfolio", "global"] as const;
export type Visibility = (typeof visibilityEnum)[number];

export const outcomeClassEnum = ["real", "synthetic"] as const;
export type OutcomeClass = (typeof outcomeClassEnum)[number];

export const contradictionStatusEnum = [
  "open",
  "resolved_in_favor_of_a",
  "resolved_in_favor_of_b",
  "both_valid_with_scope",
] as const;
export type ContradictionStatus = (typeof contradictionStatusEnum)[number];

export const llmCallTypeEnum = ["complete", "embed", "structured"] as const;
export type LlmCallType = (typeof llmCallTypeEnum)[number];

// ─────────────────────────────────────────────
// CORE TENANCY TABLES (P1, C1)
// ─────────────────────────────────────────────

/** Top-level tenant. Single-tenant today; multi-tenant-ready from day one. */
export const tenants = mysqlTable("tenant", {
  id: varchar("id", { length: 64 }).primaryKey(), // e.g. "gp1"
  name: varchar("name", { length: 255 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/** Portfolio company (portco). Each has an isolated workspace. */
export const companies = mysqlTable(
  "company",
  {
    id: int("id").autoincrement().primaryKey(),
    tenantId: varchar("tenantId", { length: 64 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    industry: varchar("industry", { length: 128 }),
    description: text("description"),
    deletedAt: timestamp("deletedAt"), // soft-delete
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (t) => [index("idx_company_tenant").on(t.tenantId)]
);

/** One strategic question / engagement within a portco. */
export const strategyProjects = mysqlTable(
  "strategy_project",
  {
    id: int("id").autoincrement().primaryKey(),
    tenantId: varchar("tenantId", { length: 64 }).notNull(),
    companyId: int("companyId").notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    deletedAt: timestamp("deletedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (t) => [
    index("idx_sp_tenant_company").on(t.tenantId, t.companyId),
  ]
);

/** One conversation / brainstorm / work block within a project. */
export const sessions = mysqlTable(
  "session",
  {
    id: int("id").autoincrement().primaryKey(),
    tenantId: varchar("tenantId", { length: 64 }).notNull(),
    companyId: int("companyId").notNull(),
    projectId: int("projectId").notNull(),
    userId: int("userId").notNull(),
    title: varchar("title", { length: 255 }),
    endedAt: timestamp("endedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (t) => [
    index("idx_session_project").on(t.tenantId, t.companyId, t.projectId),
  ]
);

// ─────────────────────────────────────────────
// USERS (extended with 3-role system)
// ─────────────────────────────────────────────

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  tenantId: varchar("tenantId", { length: 64 }).notNull().default("gp1"),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  /** 3-role system: gp > operator > portco_team. admin is a superset of gp for platform mgmt. */
  role: mysqlEnum("role", userRoleEnum).default("portco_team").notNull(),
  /** JSON array of companyIds this user can access (null = all for gp/admin) */
  assignedCompanyIds: json("assignedCompanyIds").$type<number[]>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─────────────────────────────────────────────
// MEMORY SCHEMA (P2, H8, C1, C19, C20, C21, C22)
// ─────────────────────────────────────────────

/** A single tagged, dated, confidence-scored claim in the knowledge graph. */
export const memoryItems = mysqlTable(
  "memory_item",
  {
    id: int("id").autoincrement().primaryKey(),
    // C1 — namespacing on every row
    tenantId: varchar("tenantId", { length: 64 }).notNull(),
    companyId: int("companyId").notNull(),
    projectId: int("projectId"),
    sessionId: int("sessionId"),

    // Content
    rawContent: text("rawContent").notNull(),
    /** C20 — S-P-O-qualifier normalized form; this is what gets embedded */
    canonicalForm: text("canonicalForm").notNull(),

    // C22 — embedding model version (non-nullable)
    embeddingModelVersion: varchar("embeddingModelVersion", { length: 64 }).notNull(),
    /** JSON array of floats — the embedding vector of canonicalForm */
    embedding: json("embedding").$type<number[]>(),

    // C19 — bi-temporal fields
    validAt: timestamp("validAt").notNull(),
    invalidAt: timestamp("invalidAt"), // null = currently valid
    ingestedAt: timestamp("ingestedAt").defaultNow().notNull(),

    // C21 — provenance cluster for Bayesian confidence aggregation
    provenanceClusterId: varchar("provenanceClusterId", { length: 64 }).notNull(),
    sourceUrl: text("sourceUrl"),
    sourceDomain: varchar("sourceDomain", { length: 255 }),

    // Confidence & modality
    confidence: float("confidence").notNull().default(0.5),
    claimModality: mysqlEnum("claimModality", claimModalityEnum).notNull().default("actual"),
    derivationDepth: int("derivationDepth").notNull().default(0),

    // C24 — quarantine for low-trust sources
    quarantined: boolean("quarantined").notNull().default(false),

    // Dimensional tags (H8)
    dimMarket: varchar("dimMarket", { length: 128 }),
    dimSegment: varchar("dimSegment", { length: 128 }),
    dimProduct: varchar("dimProduct", { length: 128 }),
    dimGeo: varchar("dimGeo", { length: 128 }),
    dimChannel: varchar("dimChannel", { length: 128 }),
    dimTech: varchar("dimTech", { length: 128 }),
    dimCapability: varchar("dimCapability", { length: 128 }),
    dimFramework: varchar("dimFramework", { length: 128 }),
    dimHorizon: varchar("dimHorizon", { length: 64 }),
    decayClass: mysqlEnum("decayClass", decayClassEnum).notNull().default("slow"),
    visibility: mysqlEnum("visibility", visibilityEnum).notNull().default("company"),

    // C12 — idempotency
    idempotencyKey: varchar("idempotencyKey", { length: 128 }).notNull(),

    // C19 — supersede chain
    supersededById: int("supersededById"),

    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [
    index("idx_mi_company").on(t.tenantId, t.companyId),
    index("idx_mi_project").on(t.tenantId, t.companyId, t.projectId),
    index("idx_mi_valid").on(t.validAt, t.invalidAt),
    index("idx_mi_embed_version").on(t.companyId, t.embeddingModelVersion),
    unique("uq_mi_idempotency").on(t.tenantId, t.companyId, t.idempotencyKey),
  ]
);

// ─────────────────────────────────────────────
// PREDICTION LEDGER (P2, C2, H7)
// ─────────────────────────────────────────────

export const predictions = mysqlTable(
  "prediction",
  {
    id: int("id").autoincrement().primaryKey(),
    tenantId: varchar("tenantId", { length: 64 }).notNull(),
    companyId: int("companyId").notNull(),
    projectId: int("projectId"),
    sessionId: int("sessionId"),
    userId: int("userId").notNull(),

    claim: text("claim").notNull(),
    confidence: float("confidence").notNull(),
    framework: varchar("framework", { length: 128 }),
    model: varchar("model", { length: 128 }).notNull(),
    horizon: varchar("horizon", { length: 64 }),
    targetDate: timestamp("targetDate"),

    // J4 — outcome class
    outcomeClass: mysqlEnum("outcomeClass", outcomeClassEnum).notNull().default("real"),
    // J2 — intervention tracking
    interventionTaken: boolean("interventionTaken").notNull().default(false),
    interventionLink: text("interventionLink"),
    // J7 — derivation depth
    derivationDepth: int("derivationDepth").notNull().default(0),

    // Links
    outcomeId: int("outcomeId"),
    evidenceLink: text("evidenceLink"),

    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (t) => [
    index("idx_pred_company").on(t.tenantId, t.companyId),
    index("idx_pred_project").on(t.tenantId, t.companyId, t.projectId),
  ]
);

/** Closes a prediction with an actual outcome. */
export const outcomes = mysqlTable(
  "outcome",
  {
    id: int("id").autoincrement().primaryKey(),
    tenantId: varchar("tenantId", { length: 64 }).notNull(),
    companyId: int("companyId").notNull(),
    predictionId: int("predictionId").notNull(),

    actualValue: text("actualValue").notNull(),
    measuredAt: timestamp("measuredAt").notNull(),
    source: text("source"),
    errorDelta: float("errorDelta"),
    outcomeClass: mysqlEnum("outcomeClass", outcomeClassEnum).notNull().default("real"),

    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [index("idx_outcome_prediction").on(t.predictionId)]
);

/** Separate from Prediction — "We should do X" with chosen option + alternatives (J10). */
export const decisions = mysqlTable(
  "decision",
  {
    id: int("id").autoincrement().primaryKey(),
    tenantId: varchar("tenantId", { length: 64 }).notNull(),
    companyId: int("companyId").notNull(),
    projectId: int("projectId"),
    sessionId: int("sessionId"),
    userId: int("userId").notNull(),

    title: varchar("title", { length: 255 }).notNull(),
    chosenOption: text("chosenOption").notNull(),
    alternativesConsidered: json("alternativesConsidered").$type<string[]>(),
    rationale: text("rationale"),
    linkedPredictionId: int("linkedPredictionId"),

    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (t) => [index("idx_decision_company").on(t.tenantId, t.companyId)]
);

/** Contradiction edge between two memory items. Unique constraint on (a_id, b_id). */
export const contradictions = mysqlTable(
  "contradiction",
  {
    id: int("id").autoincrement().primaryKey(),
    tenantId: varchar("tenantId", { length: 64 }).notNull(),
    companyId: int("companyId").notNull(),
    aId: int("aId").notNull(),
    bId: int("bId").notNull(),
    status: mysqlEnum("status", contradictionStatusEnum).notNull().default("open"),
    resolvedBy: int("resolvedBy"),
    resolvedAt: timestamp("resolvedAt"),
    notes: text("notes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (t) => [
    unique("uq_contradiction_pair").on(t.aId, t.bId),
    index("idx_contradiction_company").on(t.tenantId, t.companyId),
  ]
);

/** Per-domain trust prior for Bayesian confidence aggregation (C21, T12). */
export const sourceTrustRegister = mysqlTable(
  "source_trust_register",
  {
    id: int("id").autoincrement().primaryKey(),
    domain: varchar("domain", { length: 255 }).notNull().unique(),
    trustScore: float("trustScore").notNull().default(0.5),
    notes: text("notes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  }
);

// ─────────────────────────────────────────────
// AUDIT LOG (P5, C6) — append-only
// ─────────────────────────────────────────────

export const auditLogs = mysqlTable(
  "audit_log",
  {
    id: int("id").autoincrement().primaryKey(),
    tenantId: varchar("tenantId", { length: 64 }).notNull(),
    companyId: int("companyId"),
    projectId: int("projectId"),
    sessionId: int("sessionId"),
    userId: int("userId"),

    action: varchar("action", { length: 128 }).notNull(),
    resourceType: varchar("resourceType", { length: 64 }).notNull(),
    resourceId: varchar("resourceId", { length: 64 }),
    confidentialityTier: varchar("confidentialityTier", { length: 32 }).notNull().default("standard"),
    ipAddress: varchar("ipAddress", { length: 64 }),
    userAgent: text("userAgent"),
    traceId: varchar("traceId", { length: 64 }),
    metadata: json("metadata"),

    // Append-only: no updatedAt, no deletedAt
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [
    index("idx_audit_company").on(t.tenantId, t.companyId),
    index("idx_audit_user").on(t.userId),
    index("idx_audit_created").on(t.createdAt),
  ]
);

// ─────────────────────────────────────────────
// USAGE EVENT LOG (P6) — append-only
// ─────────────────────────────────────────────

export const usageEvents = mysqlTable(
  "usage_event",
  {
    id: int("id").autoincrement().primaryKey(),
    tenantId: varchar("tenantId", { length: 64 }).notNull(),
    companyId: int("companyId"),
    projectId: int("projectId"),
    sessionId: int("sessionId"),
    userId: int("userId"),
    role: mysqlEnum("role", userRoleEnum),

    surface: varchar("surface", { length: 64 }).notNull(),
    action: varchar("action", { length: 64 }).notNull(),
    metadata: json("metadata"),

    // Append-only
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [
    index("idx_usage_company").on(t.tenantId, t.companyId),
    index("idx_usage_action").on(t.action),
    index("idx_usage_created").on(t.createdAt),
  ]
);

// ─────────────────────────────────────────────
// LLM CALL LOG (P8, Workstream 0.4)
// ─────────────────────────────────────────────

export const llmCallLogs = mysqlTable(
  "llm_call_log",
  {
    id: int("id").autoincrement().primaryKey(),
    tenantId: varchar("tenantId", { length: 64 }).notNull(),
    companyId: int("companyId"),
    projectId: int("projectId"),
    sessionId: int("sessionId"),
    userId: int("userId"),

    callType: mysqlEnum("callType", llmCallTypeEnum).notNull(),
    model: varchar("model", { length: 128 }).notNull(),
    tokensIn: int("tokensIn").notNull().default(0),
    tokensOut: int("tokensOut").notNull().default(0),
    costUsd: float("costUsd").notNull().default(0),
    latencyMs: int("latencyMs"),
    traceId: varchar("traceId", { length: 64 }),
    success: boolean("success").notNull().default(true),
    errorMessage: text("errorMessage"),
    budgetEnforced: boolean("budgetEnforced").notNull().default(false),

    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [
    index("idx_llm_company").on(t.tenantId, t.companyId),
    index("idx_llm_user").on(t.userId),
    index("idx_llm_created").on(t.createdAt),
  ]
);

// ─────────────────────────────────────────────
// EXPORT JOBS (Workstream 0.5)
// ─────────────────────────────────────────────

export const exportJobs = mysqlTable(
  "export_job",
  {
    id: int("id").autoincrement().primaryKey(),
    tenantId: varchar("tenantId", { length: 64 }).notNull(),
    companyId: int("companyId").notNull(),
    requestedBy: int("requestedBy").notNull(),

    status: mysqlEnum("status", ["pending", "processing", "complete", "failed"]).notNull().default("pending"),
    storageKey: varchar("storageKey", { length: 512 }),
    downloadUrl: text("downloadUrl"),
    errorMessage: text("errorMessage"),
    expiresAt: timestamp("expiresAt"),

    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (t) => [index("idx_export_company").on(t.tenantId, t.companyId)]
);

// ─────────────────────────────────────────────
// EXECUTION-TOOL CONNECTORS (Phase 5, Workstream 5.2)
// ─────────────────────────────────────────────

export const connectorTypeEnum = ["linear", "notion", "jira"] as const;
export type ConnectorType = (typeof connectorTypeEnum)[number];

export const connectorStatusEnum = ["disconnected", "connected", "error"] as const;
export type ConnectorStatus = (typeof connectorStatusEnum)[number];

/** Per-portco execution-tool credentials — one row per (company, connector). */
export const connectorCredentials = mysqlTable(
  "connector_credential",
  {
    id: int("id").autoincrement().primaryKey(),
    tenantId: varchar("tenantId", { length: 64 }).notNull(),
    companyId: int("companyId").notNull(),
    connectorType: mysqlEnum("connectorType", connectorTypeEnum).notNull(),
    /** API token — encrypted at rest when CONNECTOR_ENC_KEY is configured. */
    credential: text("credential").notNull(),
    /** Connector-specific config, e.g. the chosen Linear team id. */
    config: json("config").$type<Record<string, string>>(),
    status: mysqlEnum("status", connectorStatusEnum).notNull().default("disconnected"),
    lastTestedAt: timestamp("lastTestedAt"),
    lastError: text("lastError"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (t) => [
    unique("uq_connector_company_type").on(t.tenantId, t.companyId, t.connectorType),
    index("idx_connector_company").on(t.tenantId, t.companyId),
  ]
);

/** Stable mapping: a local initiative ↔ an external tool item. Survives renames. */
export const connectorLinks = mysqlTable(
  "connector_link",
  {
    id: int("id").autoincrement().primaryKey(),
    tenantId: varchar("tenantId", { length: 64 }).notNull(),
    companyId: int("companyId").notNull(),
    connectorType: mysqlEnum("connectorType", connectorTypeEnum).notNull(),
    /** The local initiative key this links to. */
    localKey: varchar("localKey", { length: 512 }).notNull(),
    externalId: varchar("externalId", { length: 128 }).notNull(),
    externalUrl: text("externalUrl"),
    externalState: varchar("externalState", { length: 64 }),
    lastSyncedAt: timestamp("lastSyncedAt").defaultNow().notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [index("idx_connector_link_company").on(t.tenantId, t.companyId)]
);

// ─────────────────────────────────────────────
// DIGITAL TWIN (Phase 1 — conversational intake; salvaged from Dynamo)
// ─────────────────────────────────────────────

export const twinDimensionEnum = [
  "businessModel",
  "financials",
  "operations",
  "organization",
  "technology",
] as const;
export type TwinDimension = (typeof twinDimensionEnum)[number];

/** The captured Digital Twin for a company — one row per (company, dimension). */
export const digitalTwins = mysqlTable(
  "digital_twin",
  {
    id: int("id").autoincrement().primaryKey(),
    tenantId: varchar("tenantId", { length: 64 }).notNull(),
    companyId: int("companyId").notNull(),
    projectId: int("projectId"),
    dimension: mysqlEnum("dimension", twinDimensionEnum).notNull(),
    /** Free-text captured summary for this dimension. */
    summary: text("summary").notNull(),
    /** Optional structured facts extracted for this dimension. */
    structured: json("structured").$type<Record<string, unknown>>(),
    /** 0–100 confidence in this dimension's capture. */
    confidence: int("confidence").notNull().default(0),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (t) => [
    unique("uq_twin_company_dimension").on(t.tenantId, t.companyId, t.dimension),
    index("idx_twin_company").on(t.tenantId, t.companyId),
  ]
);

/** Per-session (or per-company) discovery completeness — the funnel signal. */
export const completenessTracking = mysqlTable(
  "completeness_tracking",
  {
    id: int("id").autoincrement().primaryKey(),
    tenantId: varchar("tenantId", { length: 64 }).notNull(),
    companyId: int("companyId").notNull(),
    sessionId: int("sessionId"),
    businessModel: int("businessModel").notNull().default(0),
    financials: int("financials").notNull().default(0),
    operations: int("operations").notNull().default(0),
    organization: int("organization").notNull().default(0),
    technology: int("technology").notNull().default(0),
    overall: int("overall").notNull().default(0),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (t) => [
    unique("uq_completeness_company_session").on(t.tenantId, t.companyId, t.sessionId),
    index("idx_completeness_company").on(t.tenantId, t.companyId),
  ]
);

// ─────────────────────────────────────────────
// STRATEGIC MANAGEMENT (Phase 5 — structured-output auto-write; salvaged from StrategyForge)
// ─────────────────────────────────────────────

export const kpiCategoryEnum = ["operational", "market", "financial", "organizational"] as const;
export type StrategyKpiCategory = (typeof kpiCategoryEnum)[number];

export const kpiStatusEnum = ["on-track", "at-risk", "off-track", "unknown"] as const;
export type StrategyKpiStatus = (typeof kpiStatusEnum)[number];

export const milestoneStatusEnum = ["planned", "in-progress", "done", "missed"] as const;
export type StrategyMilestoneStatus = (typeof milestoneStatusEnum)[number];

/** A KPI generated/tracked for a strategy project. */
export const strategyKpis = mysqlTable(
  "strategy_kpi",
  {
    id: int("id").autoincrement().primaryKey(),
    tenantId: varchar("tenantId", { length: 64 }).notNull(),
    companyId: int("companyId").notNull(),
    projectId: int("projectId"),
    label: varchar("label", { length: 255 }).notNull(),
    target: float("target"),
    current: float("current"),
    unit: varchar("unit", { length: 32 }),
    category: mysqlEnum("category", kpiCategoryEnum).notNull().default("operational"),
    status: mysqlEnum("status", kpiStatusEnum).notNull().default("unknown"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (t) => [index("idx_kpi_company_project").on(t.tenantId, t.companyId, t.projectId)]
);

/** A milestone on a strategy project's roadmap. */
export const strategyMilestones = mysqlTable(
  "strategy_milestone",
  {
    id: int("id").autoincrement().primaryKey(),
    tenantId: varchar("tenantId", { length: 64 }).notNull(),
    companyId: int("companyId").notNull(),
    projectId: int("projectId"),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    quarter: varchar("quarter", { length: 16 }),
    fiscalYear: varchar("fiscalYear", { length: 16 }),
    status: mysqlEnum("status", milestoneStatusEnum).notNull().default("planned"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (t) => [index("idx_milestone_company_project").on(t.tenantId, t.companyId, t.projectId)]
);

/** A risk on a strategy project's register, with probability × impact scoring. */
export const strategyRisks = mysqlTable(
  "strategy_risk",
  {
    id: int("id").autoincrement().primaryKey(),
    tenantId: varchar("tenantId", { length: 64 }).notNull(),
    companyId: int("companyId").notNull(),
    projectId: int("projectId"),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    /** 0–100. */
    probability: int("probability").notNull().default(0),
    /** 0–100. */
    impact: int("impact").notNull().default(0),
    /** probability × impact ÷ 100, 0–100. */
    riskScore: int("riskScore").notNull().default(0),
    mitigation: text("mitigation"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (t) => [index("idx_risk_company_project").on(t.tenantId, t.companyId, t.projectId)]
);

// ─────────────────────────────────────────────
// ANALYSIS RUNS — persisted AI outputs
// ─────────────────────────────────────────────
// Every reasoning-surface result (diagnosis, research, war-game, …) is saved
// here so strategy work is revisitable and exportable instead of evaporating
// when the user navigates away. C1-namespaced like every AI-derived row.

export const analysisKindEnum = [
  "diagnosis",
  "research",
  "frameworks",
  "options",
  "red_team",
  "war_game",
  "pre_mortem",
  "briefing",
  "brainstorm",
  "decompose",
] as const;

export const analysisRuns = mysqlTable(
  "analysis_run",
  {
    id: int("id").autoincrement().primaryKey(),
    tenantId: varchar("tenantId", { length: 64 }).notNull(),
    companyId: int("companyId").notNull(),
    projectId: int("projectId"),
    kind: mysqlEnum("kind", analysisKindEnum).notNull(),
    /** The question/strategy/input that produced this run, truncated for lists. */
    inputSummary: varchar("inputSummary", { length: 512 }).notNull(),
    /** The full normalized agent result. */
    result: json("result").$type<Record<string, unknown>>().notNull(),
    model: varchar("model", { length: 128 }),
    costUsd: float("costUsd"),
    createdBy: int("createdBy"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [
    index("idx_analysis_company_kind").on(t.tenantId, t.companyId, t.kind),
    index("idx_analysis_created").on(t.createdAt),
  ]
);

// ─────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────

export type Tenant = typeof tenants.$inferSelect;
export type Company = typeof companies.$inferSelect;
export type StrategyProject = typeof strategyProjects.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type MemoryItem = typeof memoryItems.$inferSelect;
export type Prediction = typeof predictions.$inferSelect;
export type Outcome = typeof outcomes.$inferSelect;
export type Decision = typeof decisions.$inferSelect;
export type Contradiction = typeof contradictions.$inferSelect;
export type SourceTrustRegister = typeof sourceTrustRegister.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type UsageEvent = typeof usageEvents.$inferSelect;
export type LlmCallLog = typeof llmCallLogs.$inferSelect;
export type ExportJob = typeof exportJobs.$inferSelect;
export type ConnectorCredential = typeof connectorCredentials.$inferSelect;
export type ConnectorLink = typeof connectorLinks.$inferSelect;
export type DigitalTwin = typeof digitalTwins.$inferSelect;
export type CompletenessTracking = typeof completenessTracking.$inferSelect;
export type StrategyKpi = typeof strategyKpis.$inferSelect;
export type StrategyMilestone = typeof strategyMilestones.$inferSelect;
export type StrategyRisk = typeof strategyRisks.$inferSelect;
export type AnalysisRun = typeof analysisRuns.$inferSelect;
