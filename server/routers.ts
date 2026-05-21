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
} from "./db";
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

// ─── Company Router ───────────────────────────────────────────────────────────

const companyRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    await ensureDefaultTenant();
    return listCompanies(ctx.user.tenantId);
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
      return attributeInitiative(
        input.initiative,
        input.outcome,
        input.context ?? "",
        input.companyId,
        routerCtx,
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
  contradiction: contradictionRouter,
  prediction: predictionRouter,
  cost: costRouter,
  audit: auditRouter,
  export: exportRouter,
  mcp: mcpRouter,
});

export type AppRouter = typeof appRouter;
