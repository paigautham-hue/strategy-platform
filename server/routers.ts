import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";
import {
  listCompanies,
  getCompany,
  createCompany,
  listProjects,
  createProject,
  createSession,
  listSessions,
  queryAuditLogs,
  queryUsageEvents,
  queryCostByCompany,
  queryCostByUser,
  ensureDefaultTenant,
  listUsers,
  updateUserRole,
  setAssignedCompanies,
  getConnectorCredential,
  listConnectorCredentials,
  upsertConnectorCredential,
  updateConnectorStatus,
  updateConnectorConfig,
  deleteConnectorCredential,
  recordConnectorLink,
  listConnectorLinks,
} from "./db";
import { filterAccessibleCompanies, canAccessCompany } from "./services/access";
import { encryptSecret, decryptSecret } from "./connectors/crypto";
import { testLinearConnection, listLinearTeams, createLinearIssue } from "./connectors/linear";
import { CONNECTOR_REGISTRY, isConnectorAvailable } from "./connectors";
import { writeMemory, queryMemory, supersedeMemory } from "./services/memory";
import { hybridSearchMemory } from "./services/memory-search";
import { writeLayerMemory, queryLayerMemory } from "./services/memory-layers";
import { recordPrediction, closePrediction, listPredictions, extractClaims } from "./services/predictions";
import { createExport, getExportJob } from "./services/export";
import { ingestDocument } from "./services/ingest-pipeline";
import { recognizeStrategyArtifact } from "./services/strategy-artifact";
import { applyStrategyToCompany } from "./agents/apply-strategy";
import { runApplyDeepMode } from "./agents/apply-war-game";
import { extractText } from "./ingest/extract-text";
import { parseVoiceIntent } from "./services/voice-intent";
import { diagnoseQuestion } from "./agents/diagnosis";
import { runResearchMesh } from "./agents/research";
import { runFrameworks } from "./agents/frameworks";
import { runOptionAnalysis } from "./agents/options";
import { redTeamStrategy } from "./agents/red-team";
import { runWarGame } from "./agents/war-game";
import { runCrossCoWarGame } from "./agents/cross-co-war-game";
import {
  extractBrainstormCaptures,
  generateRecap,
  type BrainstormCaptures,
} from "./agents/brainstorm";
import { structureMemo } from "./agents/memo-dictation";
import { consultPersona, listPersonas } from "./agents/personas";
import { decomposeStrategy } from "./agents/decomposer";
import { runPreMortem } from "./agents/pre-mortem";
import { detectDrift, needsReplan, proposeReplan } from "./agents/drift";
import { getCalibrationRecords, computeScorecard } from "./services/calibration";
import { attributeInitiative } from "./agents/attribution";
import { auditPredictions } from "./services/audit-constitution";
import { draftPlaybook, checkPromotion, type PlaybookLayer } from "./agents/playbook";
import { minePatterns } from "./agents/pattern-mining";
import { runSynergyScout } from "./agents/synergy-scout";
import { distillPattern } from "./services/distillation";
import { buildBriefing } from "./agents/briefing";
import { listKpis, computeKpi } from "./services/kpi-library";
import { runMonteCarlo, runSensitivity, runScenarioComparison } from "./services/monte-carlo";
import { dualCurrencyDisplay, FALLBACK_USD_INR } from "./services/currency";
import { DIMENSIONS, scoreDimensionCoverage, completenessGates } from "./services/digital-twin";
import { nextDiscoveryTurn, generateAiStrategy } from "./agents/digital-twin-interview";
import { upsertTwinDimension, getTwinSummary, saveCompleteness, isSessionInCompany } from "./services/digital-twin-store";
import { extractStrategicItems } from "./agents/strategic-extract";
import {
  writeStrategicItems,
  isProjectInCompany,
  listKpis as listStrategyKpis,
  listMilestones as listStrategyMilestones,
  listRisks as listStrategyRisks,
} from "./services/strategy-management";
import { twinDimensionEnum, type UserRole } from "../drizzle/schema";
import { generateDiagram } from "./agents/diagram";
import { multiHopQuery } from "./services/entity-graph";
import { listContradictions, resolveContradiction } from "./services/contradictions";
import { emitUsage, auditCrossCompanyRead } from "./middleware/audit";
import * as mcpGateway from "./ai/mcp-gateway";
import type { RouterContext } from "./ai/router";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a RouterContext from the tRPC context */
function buildRouterCtx(
  ctx: { user: { id: number; tenantId: string; role: string } | null },
  extra?: { companyId?: number; projectId?: number; sessionId?: number }
): RouterContext {
  return {
    tenantId: ctx.user?.tenantId ?? "gp1",
    companyId: extra?.companyId,
    projectId: extra?.projectId,
    sessionId: extra?.sessionId,
    userId: ctx.user?.id,
  };
}

/**
 * C1 company isolation at the router boundary: throw FORBIDDEN if the caller's
 * role/assignment doesn't permit this companyId. gp/admin (and unscoped operators)
 * pass; a scoped operator/portco_team may only touch their assigned companies.
 */
function assertCompanyAccess(
  user: { role: string; assignedCompanyIds?: number[] | null },
  companyId: number,
) {
  if (!canAccessCompany(user.role as UserRole, user.assignedCompanyIds ?? null, companyId)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "No access to this company" });
  }
}

/** Require GP or admin role */
const gpProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "gp" && ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "GP or admin role required" });
  }
  return next({ ctx });
});

/** Require operator or above */
const operatorProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role === "portco_team") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Operator role or above required" });
  }
  return next({ ctx });
});

/** Require admin — platform / user management. */
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin role required" });
  }
  return next({ ctx });
});

// ─── Company Router ───────────────────────────────────────────────────────────

const companyRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    await ensureDefaultTenant();
    const all = await listCompanies(ctx.user.tenantId);
    // C1: operator / portco_team users see only their assigned companies.
    return filterAccessibleCompanies(all, ctx.user.role, ctx.user.assignedCompanyIds);
  }),

  get: protectedProcedure
    .input(z.object({ companyId: z.number() }))
    .query(async ({ ctx, input }) => {
      const company = await getCompany(ctx.user.tenantId, input.companyId);
      if (!company) throw new TRPCError({ code: "NOT_FOUND" });
      return company;
    }),

  create: operatorProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        industry: z.string().optional(),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ensureDefaultTenant();
      const company = await createCompany({ tenantId: ctx.user.tenantId, ...input });
      void emitUsage({
        tenantId: ctx.user.tenantId,
        userId: ctx.user.id,
        role: ctx.user.role as "gp" | "operator" | "portco_team" | "admin",
        surface: "api",
        action: "create-company",
        metadata: { companyId: company.id },
      });
      return company;
    }),
});

// ─── Project Router ───────────────────────────────────────────────────────────

const projectRouter = router({
  list: protectedProcedure
    .input(z.object({ companyId: z.number() }))
    .query(async ({ ctx, input }) => {
      return listProjects(ctx.user.tenantId, input.companyId);
    }),

  create: operatorProcedure
    .input(
      z.object({
        companyId: z.number(),
        name: z.string().min(1).max(255),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const project = await createProject({ tenantId: ctx.user.tenantId, ...input });
      void emitUsage({
        tenantId: ctx.user.tenantId,
        companyId: input.companyId,
        userId: ctx.user.id,
        role: ctx.user.role as "gp" | "operator" | "portco_team" | "admin",
        surface: "api",
        action: "create-project",
        metadata: { projectId: project.id },
      });
      return project;
    }),
});

// ─── Session Router ───────────────────────────────────────────────────────────

const sessionRouter = router({
  list: protectedProcedure
    .input(z.object({ companyId: z.number(), projectId: z.number() }))
    .query(async ({ ctx, input }) => {
      return listSessions(ctx.user.tenantId, input.companyId, input.projectId);
    }),

  create: protectedProcedure
    .input(
      z.object({
        companyId: z.number(),
        projectId: z.number(),
        title: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return createSession({
        tenantId: ctx.user.tenantId,
        userId: ctx.user.id,
        ...input,
      });
    }),
});

// ─── Memory Router ────────────────────────────────────────────────────────────

const memoryRouter = router({
  write: protectedProcedure
    .input(
      z.object({
        companyId: z.number(),
        projectId: z.number().optional(),
        sessionId: z.number().optional(),
        rawContent: z.string().min(1),
        canonicalForm: z.string().optional(),
        confidence: z.number().min(0).max(1).optional(),
        claimModality: z.enum(["actual", "hypothetical", "simulated", "counterfactual"]).optional(),
        sourceUrl: z.string().optional(),
        dims: z
          .object({
            market: z.string().optional(),
            segment: z.string().optional(),
            product: z.string().optional(),
            geo: z.string().optional(),
            channel: z.string().optional(),
            tech: z.string().optional(),
            capability: z.string().optional(),
            framework: z.string().optional(),
            horizon: z.string().optional(),
          })
          .optional(),
        decayClass: z.enum(["permanent", "slow", "fast", "ephemeral"]).optional(),
        idempotencyKey: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return writeMemory({
        tenantId: ctx.user.tenantId,
        userId: ctx.user.id,
        ...input,
      });
    }),

  query: protectedProcedure
    .input(
      z.object({
        companyId: z.number(),
        projectId: z.number().optional(),
        query: z.string().optional(),
        limit: z.number().max(100).optional(),
        includeQuarantined: z.boolean().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      // With a query string → hybrid search (dense + keyword, RRF + MMR).
      // Without one → plain bi-temporal listing.
      if (input.query && input.query.trim()) {
        return hybridSearchMemory({
          tenantId: ctx.user.tenantId,
          companyId: input.companyId,
          projectId: input.projectId,
          query: input.query.trim(),
          limit: input.limit,
          includeQuarantined: input.includeQuarantined,
          ctx: buildRouterCtx(ctx, { companyId: input.companyId, projectId: input.projectId }),
        });
      }
      return queryMemory({
        tenantId: ctx.user.tenantId,
        userId: ctx.user.id,
        ...input,
      });
    }),

  supersede: protectedProcedure
    .input(
      z.object({
        oldItemId: z.number(),
        companyId: z.number(),
        rawContent: z.string().min(1),
        projectId: z.number().optional(),
        sessionId: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return supersedeMemory(input.oldItemId, {
        tenantId: ctx.user.tenantId,
        userId: ctx.user.id,
        companyId: input.companyId,
        projectId: input.projectId,
        sessionId: input.sessionId,
        rawContent: input.rawContent,
      });
    }),

  // Memory layers (1.7) — global framework canon + the GP's preference overlay.
  writeLayer: protectedProcedure
    .input(
      z.object({
        layer: z.enum(["global", "user"]),
        rawContent: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return writeLayerMemory(
        input.layer,
        ctx.user.tenantId,
        input.rawContent,
        buildRouterCtx(ctx),
      );
    }),

  queryLayer: protectedProcedure
    .input(
      z.object({
        layer: z.enum(["global", "user"]),
        query: z.string().min(1),
        limit: z.number().max(50).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      return queryLayerMemory(
        input.layer,
        ctx.user.tenantId,
        input.query,
        buildRouterCtx(ctx),
        input.limit,
      );
    }),
});

// ─── Prediction Router ────────────────────────────────────────────────────────

const predictionRouter = router({
  list: protectedProcedure
    .input(z.object({ companyId: z.number(), projectId: z.number().optional(), limit: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      return listPredictions({ tenantId: ctx.user.tenantId, ...input });
    }),

  record: protectedProcedure
    .input(
      z.object({
        companyId: z.number(),
        projectId: z.number().optional(),
        sessionId: z.number().optional(),
        claim: z.string().min(1),
        confidence: z.number().min(0).max(1),
        framework: z.string().optional(),
        model: z.string().default("gpt-4o"),
        horizon: z.string().optional(),
        targetDate: z.date().optional(),
        outcomeClass: z.enum(["real", "synthetic"]).optional(),
        derivationDepth: z.number().optional(),
        evidenceLink: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return recordPrediction({
        tenantId: ctx.user.tenantId,
        userId: ctx.user.id,
        ...input,
      });
    }),

  close: protectedProcedure
    .input(
      z.object({
        predictionId: z.number(),
        companyId: z.number(),
        actualValue: z.string().min(1),
        measuredAt: z.date(),
        source: z.string().optional(),
        errorDelta: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return closePrediction({
        tenantId: ctx.user.tenantId,
        ...input,
      });
    }),

  extractClaims: protectedProcedure
    .input(z.object({ text: z.string().min(1), companyId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const routerCtx = buildRouterCtx(ctx, { companyId: input.companyId });
      return extractClaims(input.text, routerCtx);
    }),
});

// ─── Cost / Analytics Router ──────────────────────────────────────────────────

const costRouter = router({
  byCompany: operatorProcedure
    .input(z.object({ companyId: z.number(), limit: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      return queryCostByCompany(ctx.user.tenantId, input.companyId, input.limit);
    }),

  byUser: gpProcedure
    .input(z.object({ userId: z.number(), limit: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      return queryCostByUser(ctx.user.tenantId, input.userId, input.limit);
    }),

  mySummary: protectedProcedure.query(async ({ ctx }) => {
    const logs = await queryCostByUser(ctx.user.tenantId, ctx.user.id, 1000);
    const totalCost = logs.reduce((sum, l) => sum + (l.costUsd ?? 0), 0);
    const totalCalls = logs.length;
    const successRate = logs.length > 0
      ? logs.filter((l) => l.success).length / logs.length
      : 1;
    const avgLatency = logs.length > 0
      ? logs.reduce((sum, l) => sum + (l.latencyMs ?? 0), 0) / logs.length
      : 0;
    return { totalCost, totalCalls, successRate, avgLatency, logs: logs.slice(0, 50) };
  }),
});

// ─── Audit Router ─────────────────────────────────────────────────────────────

const auditRouter = router({
  list: operatorProcedure
    .input(z.object({ companyId: z.number().optional(), limit: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      return queryAuditLogs({ tenantId: ctx.user.tenantId, ...input });
    }),

  usageEvents: operatorProcedure
    .input(
      z.object({
        companyId: z.number().optional(),
        action: z.string().optional(),
        limit: z.number().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      return queryUsageEvents({ tenantId: ctx.user.tenantId, ...input });
    }),
});

// ─── Export Router ────────────────────────────────────────────────────────────

const exportRouter = router({
  create: gpProcedure
    .input(z.object({ companyId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      return createExport({
        tenantId: ctx.user.tenantId,
        companyId: input.companyId,
        requestedBy: ctx.user.id,
      });
    }),

  getJob: gpProcedure
    .input(z.object({ jobId: z.number(), companyId: z.number() }))
    .query(async ({ ctx, input }) => {
      return getExportJob(input.jobId, ctx.user.tenantId, input.companyId);
    }),
});

// ─── MCP Router ───────────────────────────────────────────────────────────────

const mcpRouter = router({
  tools: protectedProcedure.query(() => {
    return mcpGateway.getToolDefinitions().map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    }));
  }),

  dispatch: protectedProcedure
    .input(
      z.object({
        toolName: z.string(),
        input: z.unknown(),
        companyId: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const routerCtx = buildRouterCtx(ctx, { companyId: input.companyId });
      return mcpGateway.dispatch(input.toolName, input.input, routerCtx);
    }),
});

// ─── Ingest Router ────────────────────────────────────────────────────────────

const ingestRouter = router({
  document: protectedProcedure
    .input(
      z.object({
        companyId: z.number(),
        projectId: z.number().optional(),
        sessionId: z.number().optional(),
        sourceType: z.enum(["text", "markdown", "html", "url"]),
        content: z.string().min(1),
        sourceUrl: z.string().optional(),
        maxChunks: z.number().min(1).max(100).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ingestDocument({
        tenantId: ctx.user.tenantId,
        userId: ctx.user.id,
        ...input,
      });
    }),
});

// ─── Strategy-Artifact Router ─────────────────────────────────────────────────

const strategyArtifactRouter = router({
  recognize: protectedProcedure
    .input(
      z.object({
        companyId: z.number(),
        sourceType: z.enum(["text", "markdown", "html", "url"]),
        content: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const extracted = await extractText(input.sourceType, input.content);
      const routerCtx = buildRouterCtx(ctx, { companyId: input.companyId });
      return recognizeStrategyArtifact(extracted.text, routerCtx);
    }),

  // Share-and-Apply (H13, 2.8): recognise an external strategy, then apply it.
  // deepMode (3.5) additionally stress-tests the adapted strategy with a quick
  // micro war-game and compares the simulated outcome against expectations.
  applyToCompany: protectedProcedure
    .input(
      z.object({
        companyId: z.number(),
        sourceType: z.enum(["text", "markdown", "html", "url"]),
        content: z.string().min(1),
        deepMode: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const extracted = await extractText(input.sourceType, input.content);
      const routerCtx = buildRouterCtx(ctx, { companyId: input.companyId });
      const artifact = await recognizeStrategyArtifact(extracted.text, routerCtx);
      const application = await applyStrategyToCompany(artifact, input.companyId, routerCtx);

      // Deep mode (3.5) — only meaningful for a real strategy artifact.
      let deepMode: Awaited<ReturnType<typeof runApplyDeepMode>> | null = null;
      if (input.deepMode && artifact.isStrategyArtifact) {
        deepMode = await runApplyDeepMode(artifact, application, input.companyId, routerCtx);
        // The micro war-game outcome is SYNTHETIC (C2, J4) — best-effort ledger write.
        try {
          await recordPrediction({
            tenantId: ctx.user.tenantId,
            companyId: input.companyId,
            userId: ctx.user.id,
            claim:
              `Applied-strategy war-game — ${deepMode.warGame.survived ? "survived" : "did not survive"} ` +
              `(${deepMode.comparison.alignment} vs expected): ${deepMode.warGame.outcome}`,
            confidence: 0.5,
            model: "war-game-simulation",
            framework: "apply_war_game",
            horizon: "simulated",
            outcomeClass: "synthetic",
          });
        } catch {
          /* ledger write is best-effort — never block the apply result */
        }
      }

      return { artifact, application, deepMode };
    }),
});

// ─── Voice Router ─────────────────────────────────────────────────────────────

const voiceRouter = router({
  parseIntent: protectedProcedure
    .input(z.object({ companyId: z.number(), transcript: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const routerCtx = buildRouterCtx(ctx, { companyId: input.companyId });
      return parseVoiceIntent(input.transcript, routerCtx);
    }),
});

// ─── Diagnosis Router (Phase 2) ───────────────────────────────────────────────

const diagnosisRouter = router({
  diagnose: protectedProcedure
    .input(
      z.object({
        companyId: z.number(),
        question: z.string().min(1),
        companyContext: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const routerCtx = buildRouterCtx(ctx, { companyId: input.companyId });
      return diagnoseQuestion(input.question, routerCtx, input.companyContext);
    }),
});

// ─── Research Router (Phase 2) ────────────────────────────────────────────────

const researchRouter = router({
  run: protectedProcedure
    .input(z.object({ companyId: z.number(), question: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const routerCtx = buildRouterCtx(ctx, { companyId: input.companyId });
      // Diagnose first (P4), then dispatch the research mesh on the reframed question.
      const diagnosis = await diagnoseQuestion(input.question, routerCtx);
      const brief = await runResearchMesh(
        diagnosis.reframedQuestion,
        diagnosis.questionType,
        input.companyId,
        routerCtx,
      );
      return { diagnosis, brief };
    }),
});

// ─── Contradiction Router (Phase 2) ───────────────────────────────────────────

const contradictionRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        companyId: z.number(),
        status: z.string().optional(),
        limit: z.number().max(100).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      return listContradictions(ctx.user.tenantId, input.companyId, {
        status: input.status,
        limit: input.limit,
      });
    }),

  resolve: protectedProcedure
    .input(
      z.object({
        contradictionId: z.number(),
        companyId: z.number(),
        resolution: z.enum([
          "resolved_in_favor_of_a",
          "resolved_in_favor_of_b",
          "both_valid_with_scope",
        ]),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return resolveContradiction({
        contradictionId: input.contradictionId,
        tenantId: ctx.user.tenantId,
        companyId: input.companyId,
        resolution: input.resolution,
        resolvedBy: ctx.user.id,
        notes: input.notes,
      });
    }),
});

// ─── Frameworks Router (Phase 3) ──────────────────────────────────────────────

const frameworksRouter = router({
  analyze: protectedProcedure
    .input(z.object({ companyId: z.number(), question: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const routerCtx = buildRouterCtx(ctx, { companyId: input.companyId });
      // Diagnose first (P4) — the question type selects the frameworks.
      const diagnosis = await diagnoseQuestion(input.question, routerCtx);
      const result = await runFrameworks(
        diagnosis.reframedQuestion,
        diagnosis.questionType,
        input.companyId,
        routerCtx,
      );
      return { diagnosis, ...result };
    }),
});

// ─── Options Router (Phase 3) ─────────────────────────────────────────────────

const optionsRouter = router({
  analyze: protectedProcedure
    .input(z.object({ companyId: z.number(), question: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const routerCtx = buildRouterCtx(ctx, { companyId: input.companyId });
      return runOptionAnalysis(input.question, input.companyId, routerCtx);
    }),
});

// ─── Red-Team Router (Phase 3) ────────────────────────────────────────────────

const redTeamRouter = router({
  review: protectedProcedure
    .input(z.object({ companyId: z.number(), strategy: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const routerCtx = buildRouterCtx(ctx, { companyId: input.companyId });
      return redTeamStrategy(input.strategy, input.companyId, routerCtx);
    }),
});

// ─── War-Game Router (Phase 3) ────────────────────────────────────────────────

const warGameRouter = router({
  run: protectedProcedure
    .input(
      z.object({
        companyId: z.number(),
        strategy: z.string().min(1),
        rounds: z.number().min(1).max(5).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const routerCtx = buildRouterCtx(ctx, { companyId: input.companyId });
      const result = await runWarGame(input.strategy, input.companyId, routerCtx, input.rounds);
      // Record the SYNTHETIC war-game outcome to the prediction ledger (C2, J4).
      try {
        await recordPrediction({
          tenantId: ctx.user.tenantId,
          companyId: input.companyId,
          userId: ctx.user.id,
          claim: `War-game outcome — ${result.survived ? "survived" : "did not survive"}: ${result.outcome}`,
          confidence: 0.5,
          model: "war-game-simulation",
          framework: "war_game",
          horizon: "simulated",
          outcomeClass: "synthetic",
        });
      } catch {
        /* ledger write is best-effort — never block the war-game result */
      }
      return result;
    }),

  // Cross-Company War-Game (3.6) — GP-only, three-layer enforcement:
  //   layer 1 (API): gpProcedure; layer 2 (query): every companyId is
  //   validated against the tenant; layer 3 (UI): page is GP-only in nav.
  // Every cross-company memory read is audit-logged (restricted tier).
  crossCompany: gpProcedure
    .input(
      z.object({
        companyIds: z.array(z.number()).min(2).max(6),
        scenario: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Layer 2 — resolve & validate each company belongs to this tenant.
      const uniqueIds = Array.from(new Set(input.companyIds));
      if (uniqueIds.length < 2) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "A cross-company war-game needs at least 2 distinct companies.",
        });
      }
      const companies: { id: number; name: string }[] = [];
      for (const id of uniqueIds) {
        const company = await getCompany(ctx.user.tenantId, id);
        if (!company) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `Company ${id} not found in this tenant.`,
          });
        }
        companies.push({ id: company.id, name: company.name });
      }

      // Audit every deliberate cross-company read (one restricted entry each).
      for (const company of companies) {
        void auditCrossCompanyRead({
          tenantId: ctx.user.tenantId,
          companyId: company.id,
          userId: ctx.user.id,
          metadata: { scenario: input.scenario, scope: uniqueIds },
        });
      }

      const routerCtx = buildRouterCtx(ctx);
      const result = await runCrossCoWarGame(input.scenario, companies, routerCtx);

      // Record the SYNTHETIC outcome to the ledger, namespaced per company (C2, J4).
      for (const outcome of result.companyOutcomes) {
        try {
          await recordPrediction({
            tenantId: ctx.user.tenantId,
            companyId: outcome.companyId,
            userId: ctx.user.id,
            claim:
              `Cross-company war-game — ${outcome.companyName} exposure ${outcome.exposure}: ` +
              outcome.outcome,
            confidence: 0.5,
            model: "war-game-simulation",
            framework: "cross_co_war_game",
            horizon: "simulated",
            outcomeClass: "synthetic",
          });
        } catch {
          /* ledger write is best-effort */
        }
      }
      return result;
    }),
});

// ─── Brainstorm Router (Phase 4) ──────────────────────────────────────────────

const brainstormRouter = router({
  // Run the five silent extractors over a brainstorm transcript.
  extract: protectedProcedure
    .input(z.object({ companyId: z.number(), transcript: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const routerCtx = buildRouterCtx(ctx, { companyId: input.companyId });
      return extractBrainstormCaptures(input.transcript, routerCtx);
    }),

  // Close the session with a recap card + suggested next moves.
  recap: protectedProcedure
    .input(
      z.object({
        companyId: z.number(),
        transcript: z.string().min(1),
        captures: z
          .object({
            hypotheses: z.array(z.string()),
            options: z.array(z.string()),
            assumptions: z.array(z.string()),
            risks: z.array(z.string()),
            openQuestions: z.array(z.string()),
          })
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const routerCtx = buildRouterCtx(ctx, { companyId: input.companyId });
      const captures: BrainstormCaptures =
        input.captures ??
        (await extractBrainstormCaptures(input.transcript, routerCtx));
      return generateRecap(input.transcript, captures, routerCtx);
    }),
});

// ─── Memo Dictation Router (Phase 4) ──────────────────────────────────────────

const memoRouter = router({
  // Structure a dictated monologue into a one-page strategy memo.
  structure: protectedProcedure
    .input(z.object({ companyId: z.number(), transcript: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const routerCtx = buildRouterCtx(ctx, { companyId: input.companyId });
      return structureMemo(input.transcript, routerCtx);
    }),
});

// ─── Persona Router (Phase 4) ─────────────────────────────────────────────────

const personaRouter = router({
  // The picker-facing registry — no stance prompts leak to the client.
  list: protectedProcedure.query(() => listPersonas()),

  // Consult a persona on a question, grounded in company memory.
  consult: protectedProcedure
    .input(
      z.object({
        companyId: z.number(),
        personaId: z.string().min(1),
        question: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const routerCtx = buildRouterCtx(ctx, { companyId: input.companyId });
      return consultPersona(input.personaId, input.question, input.companyId, routerCtx);
    }),
});

// ─── Decomposer Router (Phase 5) ──────────────────────────────────────────────

const decomposerRouter = router({
  // Decompose a strategy thesis into initiatives → OKRs → tasks.
  decompose: protectedProcedure
    .input(z.object({ companyId: z.number(), thesis: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const routerCtx = buildRouterCtx(ctx, { companyId: input.companyId });
      return decomposeStrategy(input.thesis, input.companyId, routerCtx);
    }),

  // Pre-mortem launch ritual — run before an initiative goes "active".
  preMortem: protectedProcedure
    .input(
      z.object({
        companyId: z.number(),
        initiative: z.string().min(1),
        context: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const routerCtx = buildRouterCtx(ctx, { companyId: input.companyId });
      return runPreMortem(input.initiative, input.context ?? "", input.companyId, routerCtx);
    }),
});

// ─── Drift Router (Phase 5) ───────────────────────────────────────────────────

const driftRouter = router({
  // Run the three drift detectors; when drift is found, propose a replan.
  detect: protectedProcedure
    .input(
      z.object({
        companyId: z.number(),
        initiative: z.string().min(1),
        context: z.string().optional(),
        plannedProgress: z.number().min(0).max(1),
        actualProgress: z.number().min(0).max(1),
        kpiExpected: z.number(),
        kpiActual: z.number(),
        kpiSampleSize: z.number().min(0),
        kpiHigherIsBetter: z.boolean().optional(),
        contradictionCount: z.number().min(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const report = detectDrift({
        schedule: {
          plannedProgress: input.plannedProgress,
          actualProgress: input.actualProgress,
        },
        kpi: {
          expected: input.kpiExpected,
          actual: input.kpiActual,
          sampleSize: input.kpiSampleSize,
          higherIsBetter: input.kpiHigherIsBetter,
        },
        contradictionCount: input.contradictionCount,
      });

      let replan: Awaited<ReturnType<typeof proposeReplan>> | null = null;
      if (needsReplan(report)) {
        const routerCtx = buildRouterCtx(ctx, { companyId: input.companyId });
        replan = await proposeReplan(input.initiative, report, input.context ?? "", routerCtx);
      }
      return { report, replan };
    }),
});

// ─── Calibration Router (Phase 6) ─────────────────────────────────────────────

const calibrationRouter = router({
  // The calibration scorecard for a company's closed predictions.
  scorecard: protectedProcedure
    .input(z.object({ companyId: z.number() }))
    .query(async ({ ctx, input }) => {
      const records = await getCalibrationRecords({
        tenantId: ctx.user.tenantId,
        companyId: input.companyId,
      });
      return computeScorecard(records);
    }),
});

// ─── Attribution Router (Phase 6) ─────────────────────────────────────────────

const attributionRouter = router({
  // Causal-lite attribution + auto-drafted post-mortem for a completed initiative.
  analyze: protectedProcedure
    .input(
      z.object({
        companyId: z.number(),
        initiative: z.string().min(1),
        outcome: z.string().min(1),
        context: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const routerCtx = buildRouterCtx(ctx, { companyId: input.companyId });
      // 6.6: condition attribution on the company's industry confounder DAG.
      const company = await getCompany(ctx.user.tenantId, input.companyId);
      return attributeInitiative(
        input.initiative,
        input.outcome,
        input.context ?? "",
        input.companyId,
        routerCtx,
        company?.industry ?? undefined,
      );
    }),
});

// ─── Compliance Router (Phase 6) ──────────────────────────────────────────────

const complianceRouter = router({
  // Anti-hallucination audit — constitutional compliance over the ledger.
  auditPredictions: protectedProcedure
    .input(z.object({ companyId: z.number(), limit: z.number().min(1).max(500).optional() }))
    .query(async ({ ctx, input }) => {
      const preds = await listPredictions({
        tenantId: ctx.user.tenantId,
        companyId: input.companyId,
        limit: input.limit ?? 200,
      });
      return auditPredictions(
        preds.map((p) => ({
          claim: p.claim,
          confidence: p.confidence,
          horizon: p.horizon,
        })),
      );
    }),
});

// ─── Playbook Router (Phase 6) ────────────────────────────────────────────────

const playbookRouter = router({
  // Auto-draft a playbook from a recurring pattern.
  draft: protectedProcedure
    .input(
      z.object({
        companyId: z.number(),
        pattern: z.string().min(1),
        evidenceSummary: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const routerCtx = buildRouterCtx(ctx, { companyId: input.companyId });
      return draftPlaybook(input.pattern, input.evidenceSummary ?? "", routerCtx);
    }),

  // Pure promotion-gate check — does the evidence clear the next layer?
  checkPromotion: protectedProcedure
    .input(
      z.object({
        currentLayer: z.enum(["project", "company", "portfolio"]),
        evidence: z.array(
          z.object({
            industry: z.string(),
            geo: z.string(),
            stage: z.string(),
            succeeded: z.boolean(),
          })
        ),
      })
    )
    .query(({ input }) => {
      return checkPromotion(input.currentLayer as PlaybookLayer, input.evidence);
    }),
});

// ─── Pattern Mining Router (Phase 6) ──────────────────────────────────────────

const patternRouter = router({
  // Mine a set of past projects for recurring patterns and anti-patterns.
  mine: protectedProcedure
    .input(
      z.object({
        companyId: z.number(),
        projects: z.array(z.string().min(1)).min(2).max(20),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const routerCtx = buildRouterCtx(ctx, { companyId: input.companyId });
      return minePatterns(input.projects, routerCtx);
    }),
});

// ─── Synergy Router (Phase 7) ─────────────────────────────────────────────────

const synergyRouter = router({
  // Synergy Scout — GP-only cross-portfolio synergy detection. Three-layer
  // enforcement (gpProcedure, per-company tenant validation, GP-only UI);
  // every cross-company memory read is audit-logged at restricted tier.
  scout: gpProcedure
    .input(z.object({ companyIds: z.array(z.number()).min(2).max(6) }))
    .mutation(async ({ ctx, input }) => {
      const uniqueIds = Array.from(new Set(input.companyIds));
      if (uniqueIds.length < 2) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "The Synergy Scout needs at least 2 distinct companies.",
        });
      }
      const companies: { id: number; name: string }[] = [];
      for (const id of uniqueIds) {
        const company = await getCompany(ctx.user.tenantId, id);
        if (!company) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `Company ${id} not found in this tenant.`,
          });
        }
        companies.push({ id: company.id, name: company.name });
      }

      for (const company of companies) {
        void auditCrossCompanyRead({
          tenantId: ctx.user.tenantId,
          companyId: company.id,
          userId: ctx.user.id,
          metadata: { surface: "synergy-scout", scope: uniqueIds },
        });
      }

      const routerCtx = buildRouterCtx(ctx);
      return runSynergyScout(companies, routerCtx);
    }),
});

// ─── Distillation Router (Phase 7) ────────────────────────────────────────────

const distillationRouter = router({
  // Anonymize a pattern for cross-company publication + enforce the min-N gate.
  // GP-only: anonymization is checked against every company name in the tenant.
  preview: gpProcedure
    .input(
      z.object({
        patternText: z.string().min(1),
        sourcePortcoCount: z.number().min(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const companies = await listCompanies(ctx.user.tenantId);
      return distillPattern({
        patternText: input.patternText,
        companyNames: companies.map((c) => c.name),
        sourcePortcoCount: input.sourcePortcoCount,
      });
    }),
});

// ─── Briefing Router (Phase 7) ────────────────────────────────────────────────

const briefingRouter = router({
  // Build a daily / weekly briefing from the company's recent ledger signals.
  generate: protectedProcedure
    .input(
      z.object({
        companyId: z.number(),
        cadence: z.enum(["daily", "weekly"]),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const company = await getCompany(ctx.user.tenantId, input.companyId);
      if (!company) throw new TRPCError({ code: "NOT_FOUND" });

      const preds = await listPredictions({
        tenantId: ctx.user.tenantId,
        companyId: input.companyId,
        limit: input.cadence === "daily" ? 12 : 30,
      });

      const signalLines = preds.map(
        (p) =>
          `- [${p.outcomeClass}${p.framework ? `/${p.framework}` : ""}] ` +
          `${p.claim} (confidence ${p.confidence})`,
      );
      if (input.notes && input.notes.trim()) {
        signalLines.push(`- GP note: ${input.notes.trim()}`);
      }

      const routerCtx = buildRouterCtx(ctx, { companyId: input.companyId });
      return buildBriefing(input.cadence, company.name, signalLines.join("\n"), routerCtx);
    }),
});

// ─── User Management Router (admin only) ──────────────────────────────────────

const userRouter = router({
  // List every user in the tenant.
  list: adminProcedure.query(async ({ ctx }) => {
    return listUsers(ctx.user.tenantId);
  }),

  // Change a user's role.
  updateRole: adminProcedure
    .input(
      z.object({
        userId: z.number(),
        role: z.enum(["gp", "operator", "portco_team", "admin"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // An admin cannot strip their own admin role — prevents self-lockout.
      if (input.userId === ctx.user.id && input.role !== "admin") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You cannot remove your own admin role.",
        });
      }
      await updateUserRole(ctx.user.tenantId, input.userId, input.role);
      void emitUsage({
        tenantId: ctx.user.tenantId,
        userId: ctx.user.id,
        role: ctx.user.role,
        surface: "api",
        action: "update-user-role",
        metadata: { targetUserId: input.userId, role: input.role },
      });
      return { success: true } as const;
    }),

  // Set the companies a user may access. An empty list clears scoping.
  assignCompanies: adminProcedure
    .input(z.object({ userId: z.number(), companyIds: z.array(z.number()) }))
    .mutation(async ({ ctx, input }) => {
      await setAssignedCompanies(
        ctx.user.tenantId,
        input.userId,
        input.companyIds.length > 0 ? input.companyIds : null,
      );
      void emitUsage({
        tenantId: ctx.user.tenantId,
        userId: ctx.user.id,
        role: ctx.user.role,
        surface: "api",
        action: "assign-user-companies",
        metadata: { targetUserId: input.userId, companyIds: input.companyIds },
      });
      return { success: true } as const;
    }),
});

// ─── KPI Library Router (Phase 5) ─────────────────────────────────────────────

const kpiRouter = router({
  // The reusable KPI catalog (definitions without compute functions).
  list: protectedProcedure.query(() => listKpis()),

  // Compute one KPI from named numeric inputs.
  compute: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1),
        inputs: z.record(z.string(), z.number()),
      })
    )
    .mutation(({ input }) => computeKpi(input.id, input.inputs)),
});

// ─── Simulation Router (Phase 2 — financial modelling; salvaged from StrategyForge) ─

const monteCarloInputSchema = z.object({
  baseRevenue: z.number(),
  growthRates: z.array(z.number()).min(1).max(20),
  ebitdaMargin: z.number(),
  taxRate: z.number(),
  discountRate: z.number().gt(-100), // below -100% makes NPV non-finite
  terminalGrowthRate: z.number(),
  revenueVolatility: z.number().min(0),
  marginVolatility: z.number().min(0),
  growthVolatility: z.number().min(0),
});

const simulationRouter = router({
  // Probabilistic NPV / IRR / risk distribution over a multi-year projection.
  run: protectedProcedure
    .input(
      z.object({
        input: monteCarloInputSchema,
        // Bounded to keep the synchronous CPU loop in line with the sibling caps.
        numSimulations: z.number().int().min(1).max(50_000).optional(),
        seed: z.number().int().optional(),
      })
    )
    .mutation(({ input }) =>
      runMonteCarlo(input.input, { numSimulations: input.numSimulations, seed: input.seed })
    ),

  // Sweep one input variable across a range; mean NPV at each step.
  sensitivity: protectedProcedure
    .input(
      z.object({
        input: monteCarloInputSchema,
        variable: z.enum([
          "baseRevenue",
          "ebitdaMargin",
          "taxRate",
          "discountRate",
          "terminalGrowthRate",
          "revenueVolatility",
          "marginVolatility",
          "growthVolatility",
        ]),
        range: z.object({
          min: z.number(),
          max: z.number(),
          // Bounded so steps × numSimulations stays a small synchronous workload.
          steps: z.number().int().min(1).max(50),
        }),
        numSimulations: z.number().int().min(1).max(5_000).optional(),
        seed: z.number().int().optional(),
      })
    )
    .mutation(({ input }) =>
      runSensitivity(input.input, input.variable, input.range, {
        numSimulations: input.numSimulations,
        seed: input.seed,
      })
    ),

  // Best / base / worst comparison.
  scenarios: protectedProcedure
    .input(
      z.object({
        input: monteCarloInputSchema,
        numSimulations: z.number().int().min(1).max(50_000).optional(),
        seed: z.number().int().optional(),
      })
    )
    .mutation(({ input }) =>
      runScenarioComparison(input.input, {
        numSimulations: input.numSimulations,
        seed: input.seed,
      })
    ),
});

// ─── Currency Router (Phase 5 — dual USD/INR-Crore; salvaged from StrategyForge) ─

const currencyRouter = router({
  // Dual USD + INR-Crore display. `rate` is optional; absent ⇒ documented fallback.
  dual: protectedProcedure
    .input(z.object({ usdAmount: z.number(), rate: z.number().positive().optional() }))
    .query(({ input }) => dualCurrencyDisplay(input.usdAmount, input.rate ?? FALLBACK_USD_INR)),

  // The rate currently in effect. Honest: a documented fallback, not a live quote.
  rate: protectedProcedure.query(() => ({
    rate: FALLBACK_USD_INR,
    source: "fallback" as const,
    note: "Live FX pending an fx_rate MCP tool (C3). This is a documented fallback, not a live quote.",
  })),
});

// ─── Digital Twin Router (Phase 1 — conversational intake; salvaged from Dynamo) ─

const conversationMessageSchema = z.object({ role: z.string().max(32), content: z.string().max(10_000) });
// Bounds the pure (un-budgeted) scoreDimensionCoverage work — consistent with the
// other array caps in this file (memory.query 100, ingest maxChunks 100, etc.).
const conversationArray = z.array(conversationMessageSchema).max(200);

const digitalTwinRouter = router({
  // The five business dimensions the discovery covers.
  dimensions: protectedProcedure.query(() => DIMENSIONS),

  // Pure, graded per-dimension coverage + funnel gates for a conversation.
  coverage: protectedProcedure
    .input(z.object({ messages: conversationArray }))
    .query(({ input }) => {
      const coverage = scoreDimensionCoverage(input.messages);
      return { coverage, gates: completenessGates(coverage) };
    }),

  // Next consultant turn, with the under-explored dimension steered into the prompt.
  nextTurn: protectedProcedure
    .input(
      z.object({
        history: conversationArray.default([]),
        userMessage: z.string().min(1).max(10_000),
        companyId: z.number().optional(),
      })
    )
    .mutation(({ ctx, input }) => {
      if (input.companyId !== undefined) assertCompanyAccess(ctx.user, input.companyId);
      return nextDiscoveryTurn(input.history, input.userMessage, buildRouterCtx(ctx, { companyId: input.companyId }));
    }),

  // Generate an AI-transformation strategy from the assembled Digital Twin.
  generateStrategy: protectedProcedure
    .input(
      z.object({
        twin: z.object({
          businessModel: z.string().optional(),
          financials: z.string().optional(),
          operations: z.string().optional(),
          organization: z.string().optional(),
          technology: z.string().optional(),
        }),
        companyName: z.string().optional(),
        companyId: z.number().optional(),
      })
    )
    .mutation(({ ctx, input }) => {
      if (input.companyId !== undefined) assertCompanyAccess(ctx.user, input.companyId);
      return generateAiStrategy(input.twin, buildRouterCtx(ctx, { companyId: input.companyId }), input.companyName);
    }),

  // Persist one captured dimension of a company's Digital Twin (upsert).
  saveDimension: protectedProcedure
    .input(
      z.object({
        companyId: z.number(),
        dimension: z.enum(twinDimensionEnum),
        summary: z.string().min(1).max(10_000),
        structured: z.record(z.string(), z.unknown()).optional(),
        confidence: z.number().min(0).max(100).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      assertCompanyAccess(ctx.user, input.companyId);
      await upsertTwinDimension({ tenantId: ctx.user.tenantId, ...input });
      return { ok: true };
    }),

  // Read the assembled Digital Twin (dimension → summary) for a company.
  twin: protectedProcedure
    .input(z.object({ companyId: z.number() }))
    .query(({ ctx, input }) => {
      assertCompanyAccess(ctx.user, input.companyId);
      return getTwinSummary(ctx.user.tenantId, input.companyId);
    }),

  // Compute coverage from a conversation and persist the completeness signal.
  recordCompleteness: protectedProcedure
    .input(
      z.object({
        companyId: z.number(),
        sessionId: z.number().optional(),
        messages: conversationArray,
      })
    )
    .mutation(async ({ ctx, input }) => {
      assertCompanyAccess(ctx.user, input.companyId);
      if (
        input.sessionId !== undefined &&
        !(await isSessionInCompany(ctx.user.tenantId, input.companyId, input.sessionId))
      ) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Session not found in this company" });
      }
      return saveCompleteness({
        tenantId: ctx.user.tenantId,
        companyId: input.companyId,
        sessionId: input.sessionId,
        coverage: scoreDimensionCoverage(input.messages),
      });
    }),
});

// ─── Strategic Management Router (Phase 5 — structured-output auto-write; from StrategyForge) ─

const strategyManagementRouter = router({
  // Generate KPIs / milestones / risks from a strategy context and write them.
  generate: operatorProcedure
    .input(
      z.object({
        context: z.string().min(1).max(20_000),
        companyId: z.number(),
        projectId: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      assertCompanyAccess(ctx.user, input.companyId);
      if (
        input.projectId !== undefined &&
        !(await isProjectInCompany(ctx.user.tenantId, input.companyId, input.projectId))
      ) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Project not found in this company" });
      }
      const items = await extractStrategicItems(
        input.context,
        buildRouterCtx(ctx, { companyId: input.companyId, projectId: input.projectId }),
      );
      const written = await writeStrategicItems(
        { tenantId: ctx.user.tenantId, companyId: input.companyId, projectId: input.projectId },
        items,
      );
      return { written, items };
    }),

  listKpis: protectedProcedure
    .input(z.object({ companyId: z.number(), projectId: z.number().optional() }))
    .query(({ ctx, input }) => {
      assertCompanyAccess(ctx.user, input.companyId);
      return listStrategyKpis({ tenantId: ctx.user.tenantId, companyId: input.companyId, projectId: input.projectId });
    }),

  listMilestones: protectedProcedure
    .input(z.object({ companyId: z.number(), projectId: z.number().optional() }))
    .query(({ ctx, input }) => {
      assertCompanyAccess(ctx.user, input.companyId);
      return listStrategyMilestones({ tenantId: ctx.user.tenantId, companyId: input.companyId, projectId: input.projectId });
    }),

  listRisks: protectedProcedure
    .input(z.object({ companyId: z.number(), projectId: z.number().optional() }))
    .query(({ ctx, input }) => {
      assertCompanyAccess(ctx.user, input.companyId);
      return listStrategyRisks({ tenantId: ctx.user.tenantId, companyId: input.companyId, projectId: input.projectId });
    }),
});

// ─── Connector Router (Phase 5, Workstream 5.2) ───────────────────────────────

const connectorTypeSchema = z.enum(["linear", "notion", "jira"]);

const connectorRouter = router({
  // Per-company connector status across the registry. Never returns credentials.
  list: operatorProcedure
    .input(z.object({ companyId: z.number() }))
    .query(async ({ ctx, input }) => {
      const creds = await listConnectorCredentials(ctx.user.tenantId, input.companyId);
      return CONNECTOR_REGISTRY.map((meta) => {
        const row = creds.find((c) => c.connectorType === meta.type);
        return {
          type: meta.type,
          label: meta.label,
          available: meta.available,
          description: meta.description,
          credentialLabel: meta.credentialLabel,
          configured: !!row,
          status: row?.status ?? ("not-configured" as const),
          teamName: (row?.config as Record<string, string> | null)?.teamName,
          lastTestedAt: row?.lastTestedAt ?? null,
          lastError: row?.lastError ?? null,
        };
      });
    }),

  // Store a connector credential (encrypted at rest).
  connect: operatorProcedure
    .input(
      z.object({
        companyId: z.number(),
        connectorType: connectorTypeSchema,
        credential: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!isConnectorAvailable(input.connectorType)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `The ${input.connectorType} connector is not yet available.`,
        });
      }
      await upsertConnectorCredential({
        tenantId: ctx.user.tenantId,
        companyId: input.companyId,
        connectorType: input.connectorType,
        credential: encryptSecret(input.credential.trim()),
      });
      void emitUsage({
        tenantId: ctx.user.tenantId,
        companyId: input.companyId,
        userId: ctx.user.id,
        role: ctx.user.role,
        surface: "api",
        action: "connector-connect",
        metadata: { connectorType: input.connectorType },
      });
      return { success: true } as const;
    }),

  // Test a stored credential against the live API; updates the status.
  test: operatorProcedure
    .input(z.object({ companyId: z.number(), connectorType: connectorTypeSchema }))
    .mutation(async ({ ctx, input }) => {
      const row = await getConnectorCredential(
        ctx.user.tenantId,
        input.companyId,
        input.connectorType,
      );
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Connector not configured." });

      if (input.connectorType !== "linear") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Connector not yet available." });
      }
      const result = await testLinearConnection(decryptSecret(row.credential));
      await updateConnectorStatus(
        ctx.user.tenantId,
        input.companyId,
        input.connectorType,
        result.ok ? "connected" : "error",
        result.ok ? null : result.error,
      );
      return result;
    }),

  // List the Linear teams the stored token can see (to pick a target team).
  teams: operatorProcedure
    .input(z.object({ companyId: z.number() }))
    .query(async ({ ctx, input }) => {
      const row = await getConnectorCredential(ctx.user.tenantId, input.companyId, "linear");
      if (!row) return { ok: false as const, teams: [], error: "Linear not configured." };
      const result = await listLinearTeams(decryptSecret(row.credential));
      return { ok: result.ok, teams: result.teams ?? [], error: result.error };
    }),

  // Choose the Linear team initiatives are pushed into.
  setTeam: operatorProcedure
    .input(
      z.object({
        companyId: z.number(),
        teamId: z.string().min(1),
        teamName: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await updateConnectorConfig(ctx.user.tenantId, input.companyId, "linear", {
        teamId: input.teamId,
        teamName: input.teamName,
      });
      return { success: true } as const;
    }),

  // Remove a connector credential.
  disconnect: operatorProcedure
    .input(z.object({ companyId: z.number(), connectorType: connectorTypeSchema }))
    .mutation(async ({ ctx, input }) => {
      await deleteConnectorCredential(ctx.user.tenantId, input.companyId, input.connectorType);
      return { success: true } as const;
    }),

  // Push an initiative to the connected tool as an issue.
  pushInitiative: operatorProcedure
    .input(
      z.object({
        companyId: z.number(),
        title: z.string().min(1),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const row = await getConnectorCredential(ctx.user.tenantId, input.companyId, "linear");
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Linear is not configured." });
      const teamId = (row.config as Record<string, string> | null)?.teamId;
      if (!teamId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Pick a Linear team before pushing initiatives.",
        });
      }
      const result = await createLinearIssue(
        decryptSecret(row.credential),
        teamId,
        input.title,
        input.description ?? "",
      );
      if (!result.ok || !result.issue) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: result.error ?? "Could not create the Linear issue.",
        });
      }
      await recordConnectorLink({
        tenantId: ctx.user.tenantId,
        companyId: input.companyId,
        connectorType: "linear",
        localKey: input.title,
        externalId: result.issue.id,
        externalUrl: result.issue.url,
        externalState: result.issue.state,
      });
      void emitUsage({
        tenantId: ctx.user.tenantId,
        companyId: input.companyId,
        userId: ctx.user.id,
        role: ctx.user.role,
        surface: "api",
        action: "connector-push-initiative",
        metadata: { connectorType: "linear", identifier: result.issue.identifier },
      });
      return result.issue;
    }),

  // The external links recorded for a company.
  links: operatorProcedure
    .input(z.object({ companyId: z.number() }))
    .query(async ({ ctx, input }) => {
      return listConnectorLinks(ctx.user.tenantId, input.companyId);
    }),
});

// ─── Diagram Router (Phase 4) ─────────────────────────────────────────────────

const diagramRouter = router({
  // Generate a structured strategy-diagram spec, rendered natively in the UI.
  generate: protectedProcedure
    .input(
      z.object({
        companyId: z.number(),
        diagramType: z.enum(["porter", "swot", "three_horizons"]),
        subject: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const routerCtx = buildRouterCtx(ctx, { companyId: input.companyId });
      return generateDiagram(input.diagramType, input.subject, input.companyId, routerCtx);
    }),
});

// ─── Entity Graph Router (Phase 2) ────────────────────────────────────────────

const entityGraphRouter = router({
  // Multi-hop retrieval — surface the connections between facts, not just facts.
  query: protectedProcedure
    .input(z.object({ companyId: z.number(), query: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const routerCtx = buildRouterCtx(ctx, { companyId: input.companyId });
      return multiHopQuery(input.query, input.companyId, routerCtx);
    }),
});

// ─── App Router ───────────────────────────────────────────────────────────────

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  company: companyRouter,
  user: userRouter,
  project: projectRouter,
  session: sessionRouter,
  memory: memoryRouter,
  ingest: ingestRouter,
  strategyArtifact: strategyArtifactRouter,
  voice: voiceRouter,
  diagnosis: diagnosisRouter,
  research: researchRouter,
  frameworks: frameworksRouter,
  options: optionsRouter,
  redTeam: redTeamRouter,
  warGame: warGameRouter,
  brainstorm: brainstormRouter,
  memo: memoRouter,
  persona: personaRouter,
  decomposer: decomposerRouter,
  drift: driftRouter,
  calibration: calibrationRouter,
  attribution: attributionRouter,
  compliance: complianceRouter,
  playbook: playbookRouter,
  pattern: patternRouter,
  synergy: synergyRouter,
  distillation: distillationRouter,
  briefing: briefingRouter,
  kpi: kpiRouter,
  simulation: simulationRouter,
  currency: currencyRouter,
  digitalTwin: digitalTwinRouter,
  strategyManagement: strategyManagementRouter,
  connector: connectorRouter,
  diagram: diagramRouter,
  entityGraph: entityGraphRouter,
  contradiction: contradictionRouter,
  prediction: predictionRouter,
  cost: costRouter,
  audit: auditRouter,
  export: exportRouter,
  mcp: mcpRouter,
});

export type AppRouter = typeof appRouter;
