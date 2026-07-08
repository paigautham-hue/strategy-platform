/**
 * OpenAI chat provider — C3 sibling of the forge path in llm.ts.
 *
 * Called ONLY from invokeCompletion() in llm.ts (the router's single
 * dispatcher). Uses the same OPENAI_API_KEY that powers embeddings and the
 * opt-in Realtime voice. Structured output uses response_format json_object
 * plus a schema instruction (the repo's loose schemas don't meet strict
 * json_schema constraints); the router's AJV validation stays the enforcer.
 */

import { ENV } from "./env";
import type { InvokeParams, InvokeResult, Message, MessageContent } from "./llm";

const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";
const REQUEST_TIMEOUT_MS = 120_000;
const DEFAULT_MAX_TOKENS = 4096;
const DEFAULT_MODEL = "gpt-4o-mini";

const contentToText = (content: MessageContent | MessageContent[]): string => {
  const parts = Array.isArray(content) ? content : [content];
  return parts
    .map((part) => {
      if (typeof part === "string") return part;
      if (part.type === "text") return part.text;
      return JSON.stringify(part);
    })
    .join("\n");
};

/** Build the OpenAI chat payload. Pure — exported for tests. */
export function buildOpenAiPayload(params: InvokeParams): Record<string, unknown> {
  const messages: Array<{ role: string; content: string }> = [];
  const schemaInstructions: string[] = [];

  const responseFormat = params.responseFormat ?? params.response_format;
  const schema =
    responseFormat && responseFormat.type === "json_schema"
      ? responseFormat.json_schema.schema
      : (params.outputSchema ?? params.output_schema)?.schema;
  if (schema) {
    schemaInstructions.push(
      "Respond with ONLY a single JSON object conforming to this JSON Schema. " +
        "No prose, no markdown fences.\n" +
        JSON.stringify(schema)
    );
  }

  for (const message of params.messages as Message[]) {
    const role = message.role === "assistant" ? "assistant" : message.role === "system" ? "system" : "user";
    messages.push({ role, content: contentToText(message.content) });
  }
  if (schemaInstructions.length > 0) {
    messages.unshift({ role: "system", content: schemaInstructions.join("\n\n") });
  }

  const payload: Record<string, unknown> = {
    model: params.model ?? DEFAULT_MODEL,
    messages,
    max_tokens: params.maxTokens ?? params.max_tokens ?? DEFAULT_MAX_TOKENS,
  };
  if (typeof params.temperature === "number") {
    payload.temperature = params.temperature;
  }
  if (schema || (responseFormat && responseFormat.type === "json_object")) {
    payload.response_format = { type: "json_object" };
  }
  return payload;
}

export async function invokeOpenAiChat(params: InvokeParams): Promise<InvokeResult> {
  if (!ENV.openAiApiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
  const response = await fetch(OPENAI_CHAT_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${ENV.openAiApiKey}`,
    },
    body: JSON.stringify(buildOpenAiPayload(params)),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `OpenAI invoke failed: ${response.status} ${response.statusText} – ${errorText}`
    );
  }
  return (await response.json()) as InvokeResult;
}
