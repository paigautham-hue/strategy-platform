/**
 * Google Gemini provider — C3 sibling of the forge path in llm.ts.
 *
 * Called ONLY from invokeCompletion() in llm.ts (the router's single
 * dispatcher). Uses the Generative Language REST API directly with the same
 * GOOGLE_GEMINI_API_KEY that powers Gemini Live voice. Structured output uses
 * responseMimeType: application/json plus a schema instruction in the system
 * prompt (the repo's loose schemas don't meet responseSchema constraints);
 * the router's AJV validation remains the enforcement layer.
 */

import { ENV } from "./env";
import type { InvokeParams, InvokeResult, Message, MessageContent } from "./llm";

const REQUEST_TIMEOUT_MS = 120_000;
const DEFAULT_MAX_TOKENS = 4096;
const DEFAULT_MODEL = "gemini-2.5-flash";

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

/** Build the Gemini generateContent payload. Pure — exported for tests. */
export function buildGooglePayload(params: InvokeParams): Record<string, unknown> {
  const systemParts: string[] = [];
  const contents: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }> = [];

  for (const message of params.messages as Message[]) {
    const text = contentToText(message.content);
    if (message.role === "system") {
      systemParts.push(text);
    } else if (message.role === "assistant") {
      contents.push({ role: "model", parts: [{ text }] });
    } else {
      contents.push({ role: "user", parts: [{ text }] });
    }
  }
  if (contents.length === 0 || contents[0].role !== "user") {
    contents.unshift({ role: "user", parts: [{ text: "Proceed." }] });
  }

  const responseFormat = params.responseFormat ?? params.response_format;
  const schema =
    responseFormat && responseFormat.type === "json_schema"
      ? responseFormat.json_schema.schema
      : (params.outputSchema ?? params.output_schema)?.schema;

  const generationConfig: Record<string, unknown> = {
    maxOutputTokens: params.maxTokens ?? params.max_tokens ?? DEFAULT_MAX_TOKENS,
  };
  if (typeof params.temperature === "number") {
    generationConfig.temperature = params.temperature;
  }
  if (schema) {
    generationConfig.responseMimeType = "application/json";
    systemParts.push(
      "Respond with ONLY a single JSON object conforming to this JSON Schema. " +
        "No prose, no markdown fences.\n" +
        JSON.stringify(schema)
    );
  } else if (responseFormat && responseFormat.type === "json_object") {
    generationConfig.responseMimeType = "application/json";
  }

  const payload: Record<string, unknown> = { contents, generationConfig };
  if (systemParts.length > 0) {
    payload.systemInstruction = { parts: [{ text: systemParts.join("\n\n") }] };
  }
  return payload;
}

interface GoogleResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
}

/** Map a generateContent response to the shared InvokeResult shape. Pure. */
export function mapGoogleResponse(data: GoogleResponse, model: string): InvokeResult {
  const candidate = data.candidates?.[0];
  const text = (candidate?.content?.parts ?? [])
    .map((p) => p.text ?? "")
    .join("");
  if (text.trim().length === 0) {
    throw new Error(`Google response empty (finishReason: ${candidate?.finishReason ?? "none"})`);
  }
  const promptTokens = data.usageMetadata?.promptTokenCount ?? 0;
  const completionTokens = data.usageMetadata?.candidatesTokenCount ?? 0;
  return {
    id: `google-${Date.now()}`,
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        message: { role: "assistant", content: text },
        finish_reason: candidate?.finishReason ?? null,
      },
    ],
    usage: {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: promptTokens + completionTokens,
    },
  };
}

export async function invokeGoogle(params: InvokeParams): Promise<InvokeResult> {
  if (!ENV.geminiApiKey) {
    throw new Error("GOOGLE_GEMINI_API_KEY is not configured");
  }
  const model = params.model ?? DEFAULT_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-goog-api-key": ENV.geminiApiKey,
    },
    body: JSON.stringify(buildGooglePayload(params)),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Google invoke failed: ${response.status} ${response.statusText} – ${errorText}`
    );
  }
  return mapGoogleResponse((await response.json()) as GoogleResponse, model);
}
