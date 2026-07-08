/**
 * Anthropic provider — C3 sibling of the forge path in llm.ts.
 *
 * Called ONLY from invokeCompletion() in llm.ts, which is called only by the
 * LLM router (server/ai/router.ts). Never import this module from domain code.
 *
 * Provider facts this module encodes:
 * - POST https://api.anthropic.com/v1/messages with x-api-key + anthropic-version.
 * - System messages must be hoisted into the top-level `system` field.
 * - claude-fable-5 (and opus-4.7/4.8) reject `temperature` and any `thinking`
 *   config with a 400 — sampling params are sent only to models that accept them.
 * - Structured output uses a JSON instruction appended to the system prompt;
 *   the router's AJV validation remains the enforcement layer. Native
 *   output_config.format is deferred until the repo's schemas are strict.
 * - A 200 with stop_reason "refusal" (or empty content) throws so the
 *   dispatcher's forge fallback can take over.
 */

import { ENV } from "./env";
import type { InvokeParams, InvokeResult, Message, MessageContent } from "./llm";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const REQUEST_TIMEOUT_MS = 120_000;
const DEFAULT_MAX_TOKENS = 4096;

/** Model prefixes that reject temperature/top_p/top_k (adaptive-sampling models). */
const SAMPLING_UNSUPPORTED_PREFIXES = ["claude-fable", "claude-opus-4-7", "claude-opus-4-8"];

export function isSamplingParamSupported(model: string): boolean {
  return !SAMPLING_UNSUPPORTED_PREFIXES.some((p) => model.startsWith(p));
}

export class AnthropicRefusalError extends Error {
  constructor(reason: string) {
    super(`Anthropic refusal: ${reason}`);
    this.name = "AnthropicRefusalError";
  }
}

// ─── Message mapping (pure, exported for tests) ───────────────────────────────

const contentToText = (content: MessageContent | MessageContent[]): string => {
  const parts = Array.isArray(content) ? content : [content];
  return parts
    .map((part) => {
      if (typeof part === "string") return part;
      if (part.type === "text") return part.text;
      // Image/file parts are not supported on this path today; keep the
      // information visible rather than dropping it silently.
      return JSON.stringify(part);
    })
    .join("\n");
};

/**
 * Build the Anthropic /v1/messages payload from router-shaped InvokeParams.
 * Pure function — exported for unit tests.
 */
export function buildAnthropicPayload(params: InvokeParams): Record<string, unknown> {
  const model = params.model ?? "claude-haiku-4-5";
  const systemParts: string[] = [];
  const mapped: Array<{ role: "user" | "assistant"; content: string }> = [];

  for (const message of params.messages as Message[]) {
    const text = contentToText(message.content);
    if (message.role === "system") {
      systemParts.push(text);
    } else if (message.role === "assistant") {
      mapped.push({ role: "assistant", content: text });
    } else {
      // user / tool / function all collapse to user text — agents do not use
      // in-call tool results today; this is a guard, not a feature.
      mapped.push({ role: "user", content: text });
    }
  }

  // Anthropic requires at least one message and the first must be from the user.
  if (mapped.length === 0 || mapped[0].role !== "user") {
    mapped.unshift({ role: "user", content: "Proceed." });
  }

  // Structured output: translate the OpenAI-style response_format into a
  // JSON-only instruction. The router validates the result with AJV.
  const responseFormat = params.responseFormat ?? params.response_format;
  const schema =
    responseFormat && responseFormat.type === "json_schema"
      ? responseFormat.json_schema.schema
      : (params.outputSchema ?? params.output_schema)?.schema;
  if (schema) {
    systemParts.push(
      "Respond with ONLY a single JSON object conforming to this JSON Schema. " +
        "No prose, no markdown fences.\n" +
        JSON.stringify(schema)
    );
  } else if (responseFormat && responseFormat.type === "json_object") {
    systemParts.push("Respond with ONLY a single valid JSON object. No prose, no markdown fences.");
  }

  const payload: Record<string, unknown> = {
    model,
    max_tokens: params.maxTokens ?? params.max_tokens ?? DEFAULT_MAX_TOKENS,
    messages: mapped,
  };
  if (systemParts.length > 0) {
    payload.system = systemParts.join("\n\n");
  }
  if (typeof params.temperature === "number" && isSamplingParamSupported(model)) {
    payload.temperature = params.temperature;
  }
  // Never send a `thinking` param — always-on-thinking models 400 on any
  // explicit thinking config, including { type: "disabled" }.
  return payload;
}

// ─── Response mapping (pure, exported for tests) ──────────────────────────────

interface AnthropicResponse {
  id: string;
  model: string;
  stop_reason: string | null;
  content: Array<{ type: string; text?: string }>;
  usage?: { input_tokens?: number; output_tokens?: number };
}

/** Strip a single leading/trailing markdown code fence if present. */
export function stripJsonFences(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/);
  return match ? match[1].trim() : trimmed;
}

export function mapAnthropicResponse(
  data: AnthropicResponse,
  hadSchema: boolean
): InvokeResult {
  const text = data.content
    .filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text as string)
    .join("");

  if (data.stop_reason === "refusal" || text.trim().length === 0) {
    throw new AnthropicRefusalError(data.stop_reason ?? "empty response");
  }

  const promptTokens = data.usage?.input_tokens ?? 0;
  const completionTokens = data.usage?.output_tokens ?? 0;

  return {
    id: data.id,
    created: Math.floor(Date.now() / 1000),
    model: data.model,
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: hadSchema ? stripJsonFences(text) : text,
        },
        finish_reason: data.stop_reason,
      },
    ],
    usage: {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: promptTokens + completionTokens,
    },
  };
}

// ─── The provider call ────────────────────────────────────────────────────────

export async function invokeAnthropic(params: InvokeParams): Promise<InvokeResult> {
  if (!ENV.anthropicApiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }

  const payload = buildAnthropicPayload(params);

  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": ENV.anthropicApiKey,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Anthropic invoke failed: ${response.status} ${response.statusText} – ${errorText}`
    );
  }

  const data = (await response.json()) as AnthropicResponse;
  const hadSchema = Boolean(
    (params.responseFormat ?? params.response_format)?.type === "json_schema" ||
      params.outputSchema ||
      params.output_schema
  );
  return mapAnthropicResponse(data, hadSchema);
}
