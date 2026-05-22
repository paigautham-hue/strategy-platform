/**
 * LLM Router — C3, P3
 *
 * THE ONLY FILE THAT MAY CALL THE LLM OR EMBEDDING API.
 * All domain code calls router.complete(), router.embed(), router.structured().
 * Provider SDKs must never be imported outside this module.
 *
 * Enforces:
 *   1. PII redaction (C5) before every call
 *   2. Budget enforcement (P8) before every call
 *   3. Per-call cost logging to llm_call_log
 *   4. OpenTelemetry trace ID on every call
 *   5. Model selection from models.yaml (M1) — no hardcoded model strings
 *   6. Structured output validated against JSON schema (M4)
 *   7. Real embeddings via OpenAI text-embedding-3-small (B2/B3)
 */

import { nanoid } from "nanoid";
import Ajv from "ajv";
import { invokeLLM } from "../_core/llm";
import { ENV } from "../_core/env";
import { redactMessages, redact } from "./redactor";
import {
  checkBudget,
  estimateCost,
  estimateTokens,
  BudgetExceededError,
  DEFAULT_ENVELOPE,
  type BudgetEnvelope,
} from "./budget";
import { getCompletionConfig, getActiveEmbeddingConfig } from "./models-config";
import { getDb } from "../db";
import { llmCallLogs } from "../../drizzle/schema";
import { embeddingCache, embeddingCacheKey } from "../services/cache";

// ─── AJV instance for M4 ──────────────────────────────────────────────────────

const ajv = new Ajv({ strict: false, allErrors: true });

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RouterContext {
  tenantId: string;
  companyId?: number;
  projectId?: number;
  sessionId?: number;
  userId?: number;
  traceId?: string;
}

export interface CompleteOptions {
  messages: Array<{ role: string; content: string | unknown }>;
  systemPrompt?: string;
  envelope?: BudgetEnvelope;
  ctx: RouterContext;
  task?: "default" | "extraction" | "structured" | "creative";
}

export interface EmbedOptions {
  text: string;
  envelope?: BudgetEnvelope;
  ctx: RouterContext;
}

export interface StructuredOptions<T = unknown> {
  messages: Array<{ role: string; content: string | unknown }>;
  schema: {
    name: string;
    strict?: boolean;
    schema: Record<string, unknown>;
  };
  envelope?: BudgetEnvelope;
  ctx: RouterContext;
}

export interface RouterResponse {
  content: string;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  latencyMs: number;
  traceId: string;
  model: string;
}

export interface EmbedResponse {
  embedding: number[];
  dimensions: number;
  tokensIn: number;
  costUsd: number;
  latencyMs: number;
  traceId: string;
  /** True when the embedding was served from the cache (Phase 8.1). */
  cached?: boolean;
  /** Exact model identifier returned by the embedding provider (B3). */
  model: string;
  /** Canonical version string for embeddingModelVersion column (B3). */
  modelVersion: string;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function logCall(params: {
  ctx: RouterContext;
  callType: "complete" | "embed" | "structured";
  model: string;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  latencyMs: number;
  traceId: string;
  success: boolean;
  errorMessage?: string;
  budgetEnforced?: boolean;
}) {
  try {
    const db = await getDb();
    if (!db) return;
    await db.insert(llmCallLogs).values({
      tenantId: params.ctx.tenantId,
      companyId: params.ctx.companyId,
      projectId: params.ctx.projectId,
      sessionId: params.ctx.sessionId,
      userId: params.ctx.userId,
      callType: params.callType,
      model: params.model,
      tokensIn: params.tokensIn,
      tokensOut: params.tokensOut,
      costUsd: params.costUsd,
      latencyMs: params.latencyMs,
      traceId: params.traceId,
      success: params.success,
      errorMessage: params.errorMessage,
      budgetEnforced: params.budgetEnforced ?? false,
    });
  } catch (err) {
    console.error("[router] Failed to log LLM call:", err);
  }
}

// ─── router.complete ──────────────────────────────────────────────────────────

/**
 * Send a chat completion request.
 * Model selected from models.yaml (M1). Runs PII redaction → budget check → LLM call → cost log.
 */
export async function complete(opts: CompleteOptions): Promise<RouterResponse> {
  const traceId = opts.ctx.traceId ?? nanoid(16);
  const envelope = opts.envelope ?? DEFAULT_ENVELOPE;
  const start = Date.now();

  // M1: Read model config from models.yaml
  const modelCfg = getCompletionConfig(opts.task ?? "default");
  const modelLabel = `${modelCfg.provider}/${modelCfg.model}`;

  // C5: Redact PII before any LLM call
  const redactedMessages = redactMessages(
    opts.messages as Array<{ role: string; content: string | unknown }>
  );

  const inputText = redactedMessages
    .map((m) => (typeof m.content === "string" ? m.content : JSON.stringify(m.content)))
    .join(" ");
  const inputTokens = estimateTokens(inputText);
  const estimatedOutputTokens = Math.min(envelope.maxOutputTokens, 1000);
  const estimatedCost = estimateCost(inputTokens, estimatedOutputTokens);

  const budgetCheck = checkBudget(inputTokens, estimatedOutputTokens, estimatedCost, envelope);
  if (!budgetCheck.allowed) {
    await logCall({
      ctx: opts.ctx,
      callType: "complete",
      model: modelLabel,
      tokensIn: inputTokens,
      tokensOut: 0,
      costUsd: 0,
      latencyMs: Date.now() - start,
      traceId,
      success: false,
      errorMessage: budgetCheck.reason,
      budgetEnforced: true,
    });
    throw new BudgetExceededError(budgetCheck.reason!, budgetCheck.hardKill);
  }

  if (budgetCheck.warn) {
    console.warn(`[router] Budget warning (traceId=${traceId}): ${budgetCheck.reason ?? "approaching soft cap"}`);
  }

  let tokensIn = inputTokens;
  let tokensOut = 0;
  let costUsd = 0;
  let success = true;
  let errorMessage: string | undefined;
  let content = "";

  try {
    const allMessages = opts.systemPrompt
      ? [{ role: "system", content: opts.systemPrompt }, ...redactedMessages]
      : redactedMessages;

    const response = await invokeLLM({
      messages: allMessages as Parameters<typeof invokeLLM>[0]["messages"],
      // M1: pass model from models.yaml — Manus forge uses this to select the backend model
      model: modelCfg.model !== "auto" ? modelCfg.model : undefined,
    });
    const rawContent = response.choices?.[0]?.message?.content ?? "";
    content = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent);

    if (response.usage) {
      tokensIn = response.usage.prompt_tokens ?? inputTokens;
      tokensOut = response.usage.completion_tokens ?? 0;
    } else {
      tokensOut = estimateTokens(content);
    }
    costUsd = estimateCost(tokensIn, tokensOut);
  } catch (err) {
    success = false;
    errorMessage = err instanceof Error ? err.message : String(err);
    throw err;
  } finally {
    const latencyMs = Date.now() - start;
    await logCall({
      ctx: opts.ctx,
      callType: "complete",
      model: modelLabel,
      tokensIn,
      tokensOut,
      costUsd,
      latencyMs,
      traceId,
      success,
      errorMessage,
    });
  }

  return {
    content,
    tokensIn,
    tokensOut,
    costUsd,
    latencyMs: Date.now() - start,
    traceId,
    model: modelLabel,
  };
}

// ─── router.embed ─────────────────────────────────────────────────────────────

/**
 * Generate a real embedding vector via OpenAI text-embedding-3-small (B2/B3).
 *
 * - Model and dimensions read from models.yaml (M1).
 * - PII redacted before the call (C5).
 * - modelVersion stamped with the model string returned by OpenAI (B3).
 * - Manus forge has no /v1/embeddings endpoint; direct HTTPS call is required.
 *   Outbound HTTPS to api.openai.com is confirmed available from the sandbox.
 */
export async function embed(opts: EmbedOptions): Promise<EmbedResponse> {
  const traceId = opts.ctx.traceId ?? nanoid(16);
  const envelope = opts.envelope ?? DEFAULT_ENVELOPE;
  const start = Date.now();

  // M1: Read active embedding config from models.yaml
  const { key: embeddingKey, config: embeddingCfg } = getActiveEmbeddingConfig();

  if (embeddingCfg.status === "deferred") {
    throw new Error(`[router] Embedding provider '${embeddingKey}' is deferred. Check models.yaml.`);
  }

  if (!ENV.openAiApiKey) {
    throw new Error("[router] OPENAI_API_KEY is not configured. Cannot generate real embeddings.");
  }

  // C5: Redact PII
  const { redacted } = redact(opts.text);

  // 8.1: Embedding cache — a text embeds to the same vector for a given model,
  // so a cache hit costs nothing and is never budget-checked or logged.
  const embedCacheKey = embeddingCacheKey(embeddingCfg.model, embeddingCfg.dimensions, redacted);
  const cachedEmbedding = embeddingCache.get(embedCacheKey);
  if (cachedEmbedding) {
    return {
      embedding: cachedEmbedding,
      dimensions: cachedEmbedding.length,
      tokensIn: 0,
      costUsd: 0,
      latencyMs: Date.now() - start,
      traceId,
      model: embeddingCfg.model,
      modelVersion: `openai:${embeddingCfg.model}:dims=${cachedEmbedding.length}`,
      cached: true,
    };
  }

  const inputTokens = estimateTokens(redacted);
  const estimatedCost = estimateCost(inputTokens, 0);

  const budgetCheck = checkBudget(inputTokens, 0, estimatedCost, envelope);
  if (!budgetCheck.allowed) {
    await logCall({
      ctx: opts.ctx,
      callType: "embed",
      model: embeddingCfg.model,
      tokensIn: inputTokens,
      tokensOut: 0,
      costUsd: 0,
      latencyMs: Date.now() - start,
      traceId,
      success: false,
      errorMessage: budgetCheck.reason,
      budgetEnforced: true,
    });
    throw new BudgetExceededError(budgetCheck.reason!, budgetCheck.hardKill);
  }

  let embedding: number[] = [];
  let tokensIn = inputTokens;
  let costUsd = 0;
  let success = true;
  let errorMessage: string | undefined;
  // B3: will be set to the model string returned by OpenAI, not a hardcoded label
  let actualModel = embeddingCfg.model;

  try {
    // B2: Real embedding call to OpenAI text-embedding-3-small
    const resp = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${ENV.openAiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: redacted,
        model: embeddingCfg.model,
        dimensions: embeddingCfg.dimensions,
      }),
    });

    if (!resp.ok) {
      const errBody = await resp.text();
      throw new Error(`OpenAI embeddings error ${resp.status}: ${errBody}`);
    }

    const data = await resp.json() as {
      object: string;
      data: Array<{ object: string; embedding: number[]; index: number }>;
      model: string;
      usage: { prompt_tokens: number; total_tokens: number };
    };

    embedding = data.data[0].embedding;
    // B3: Stamp the exact model string returned by OpenAI (e.g. "text-embedding-3-small")
    actualModel = data.model;
    tokensIn = data.usage?.prompt_tokens ?? inputTokens;
    // OpenAI embedding pricing: $0.02 / 1M tokens
    costUsd = (tokensIn / 1_000_000) * 0.02;
    // 8.1: Cache the vector so the same text is never embedded twice.
    if (embedding.length > 0) embeddingCache.set(embedCacheKey, embedding);
  } catch (err) {
    success = false;
    errorMessage = err instanceof Error ? err.message : String(err);
    throw err;
  } finally {
    const latencyMs = Date.now() - start;
    await logCall({
      ctx: opts.ctx,
      callType: "embed",
      model: actualModel,
      tokensIn,
      tokensOut: 0,
      costUsd,
      latencyMs,
      traceId,
      success,
      errorMessage,
    });
  }

  // B3: modelVersion = "openai:{model}:dims={dimensions}" — truthful, derived from API response
  const modelVersion = `openai:${actualModel}:dims=${embedding.length}`;

  return {
    embedding,
    dimensions: embedding.length,
    tokensIn,
    costUsd,
    latencyMs: Date.now() - start,
    traceId,
    model: actualModel,
    modelVersion,
  };
}

// ─── router.structured ───────────────────────────────────────────────────────

/**
 * Send a structured (JSON schema) completion request.
 * M4: Validates output against the schema using AJV before returning.
 * M1: Model selected from models.yaml.
 */
export async function structured<T = unknown>(opts: StructuredOptions<T>): Promise<{ data: T } & RouterResponse> {
  const traceId = opts.ctx.traceId ?? nanoid(16);
  const envelope = opts.envelope ?? DEFAULT_ENVELOPE;
  const start = Date.now();

  // M1: Use structured task config from models.yaml
  const modelCfg = getCompletionConfig("structured");
  const modelLabel = `${modelCfg.provider}/${modelCfg.model}`;

  // C5: Redact PII
  const redactedMessages = redactMessages(
    opts.messages as Array<{ role: string; content: string | unknown }>
  );

  const inputText = redactedMessages
    .map((m) => (typeof m.content === "string" ? m.content : JSON.stringify(m.content)))
    .join(" ");
  const inputTokens = estimateTokens(inputText);
  const estimatedOutputTokens = Math.min(envelope.maxOutputTokens, 1000);
  const estimatedCost = estimateCost(inputTokens, estimatedOutputTokens);

  const budgetCheck = checkBudget(inputTokens, estimatedOutputTokens, estimatedCost, envelope);
  if (!budgetCheck.allowed) {
    await logCall({
      ctx: opts.ctx,
      callType: "structured",
      model: modelLabel,
      tokensIn: inputTokens,
      tokensOut: 0,
      costUsd: 0,
      latencyMs: Date.now() - start,
      traceId,
      success: false,
      errorMessage: budgetCheck.reason,
      budgetEnforced: true,
    });
    throw new BudgetExceededError(budgetCheck.reason!, budgetCheck.hardKill);
  }

  if (budgetCheck.warn) {
    console.warn(`[router] Budget warning (traceId=${traceId}): approaching soft cap`);
  }

  let tokensIn = inputTokens;
  let tokensOut = 0;
  let costUsd = 0;
  let success = true;
  let errorMessage: string | undefined;
  let data: T = {} as T;
  let content = "";

  try {
    const response = await invokeLLM({
      messages: redactedMessages as Parameters<typeof invokeLLM>[0]["messages"],
      response_format: {
        type: "json_schema",
        json_schema: opts.schema,
      },
      // M1: pass model from models.yaml
      model: modelCfg.model !== "auto" ? modelCfg.model : undefined,
    });

    const rawStructured = response.choices?.[0]?.message?.content ?? "{}";
    content = typeof rawStructured === "string" ? rawStructured : JSON.stringify(rawStructured);

    // M4: Parse then validate against the declared JSON schema
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch (parseErr) {
      throw new Error(`[router.structured] LLM returned non-JSON: ${content.slice(0, 200)}`);
    }

    // Compile and validate with AJV
    const validate = ajv.compile(opts.schema.schema);
    const valid = validate(parsed);
    if (!valid) {
      const errors = ajv.errorsText(validate.errors);
      throw new Error(`[router.structured] Schema validation failed: ${errors}`);
    }

    data = parsed as T;

    if (response.usage) {
      tokensIn = response.usage.prompt_tokens ?? inputTokens;
      tokensOut = response.usage.completion_tokens ?? 0;
    } else {
      tokensOut = estimateTokens(content);
    }
    costUsd = estimateCost(tokensIn, tokensOut);
  } catch (err) {
    success = false;
    errorMessage = err instanceof Error ? err.message : String(err);
    throw err;
  } finally {
    const latencyMs = Date.now() - start;
    await logCall({
      ctx: opts.ctx,
      callType: "structured",
      model: modelLabel,
      tokensIn,
      tokensOut,
      costUsd,
      latencyMs,
      traceId,
      success,
      errorMessage,
    });
  }

  return {
    data,
    content,
    tokensIn,
    tokensOut,
    costUsd,
    latencyMs: Date.now() - start,
    traceId,
    model: modelLabel,
  };
}
