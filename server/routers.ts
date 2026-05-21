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
import { extractText } from "./ingest/extract-text";
import { parseVoiceIntent } from "./services/voice-intent";
import { diagnoseQuestion } from "./agents/diagnosis";
import { emitUsage } from "./middleware/audit";
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
  prediction: predictionRouter,
  cost: costRouter,
  audit: auditRouter,
  export: exportRouter,
  mcp: mcpRouter,
});

export type AppRouter = typeof appRouter;
