/**
 * Multi-provider routing test suite (C3 / M1)
 *
 * Covers:
 *   1. Anthropic payload construction (system hoisting, sampling-param rules,
 *      JSON-schema instruction, never sending `thinking`)
 *   2. Anthropic response mapping (usage fields, fence stripping, refusal)
 *   3. invokeCompletion dispatch + degrade-to-forge fallback
 *   4. Per-model pricing in estimateCost
 *   5. models.yaml task tiers (planner/worker) + planner budget envelope
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  buildAnthropicPayload,
  mapAnthropicResponse,
  stripJsonFences,
  isSamplingParamSupported,
  AnthropicRefusalError,
} from "../_core/anthropic";
import { estimateCost } from "../ai/budget";
import { getCompletionConfig, getBudgetDefaults } from "../ai/models-config";
import type { Message } from "../_core/llm";

// ─── 1. buildAnthropicPayload ─────────────────────────────────────────────────

describe("buildAnthropicPayload", () => {
  const baseMessages: Message[] = [
    { role: "system", content: "You are a strategy analyst." },
    { role: "user", content: "Analyse the market." },
  ];

  it("hoists system messages into the top-level system field", () => {
    const payload = buildAnthropicPayload({ messages: baseMessages, model: "claude-haiku-4-5" });
    expect(payload.system).toContain("You are a strategy analyst.");
    const messages = payload.messages as Array<{ role: string; content: string }>;
    expect(messages).toHaveLength(1);
    expect(messages[0]).toEqual({ role: "user", content: "Analyse the market." });
  });

  it("omits temperature for claude-fable-5 (rejects sampling params)", () => {
    const payload = buildAnthropicPayload({
      messages: baseMessages,
      model: "claude-fable-5",
      temperature: 0.3,
    });
    expect(payload).not.toHaveProperty("temperature");
  });

  it("includes temperature for claude-haiku-4-5", () => {
    const payload = buildAnthropicPayload({
      messages: baseMessages,
      model: "claude-haiku-4-5",
      temperature: 0.1,
    });
    expect(payload.temperature).toBe(0.1);
  });

  it("never sends a thinking param", () => {
    for (const model of ["claude-fable-5", "claude-haiku-4-5"]) {
      const payload = buildAnthropicPayload({ messages: baseMessages, model });
      expect(payload).not.toHaveProperty("thinking");
    }
  });

  it("forwards maxTokens and defaults to 4096", () => {
    expect(
      buildAnthropicPayload({ messages: baseMessages, model: "claude-fable-5", maxTokens: 8192 })
        .max_tokens
    ).toBe(8192);
    expect(
      buildAnthropicPayload({ messages: baseMessages, model: "claude-fable-5" }).max_tokens
    ).toBe(4096);
  });

  it("translates a json_schema response_format into a system instruction", () => {
    const schema = { type: "object", properties: { verdict: { type: "string" } } };
    const payload = buildAnthropicPayload({
      messages: baseMessages,
      model: "claude-haiku-4-5",
      response_format: { type: "json_schema", json_schema: { name: "verdict", schema } },
    });
    expect(payload.system).toContain("ONLY a single JSON object");
    expect(payload.system).toContain('"verdict"');
  });

  it("ensures the first message is from the user", () => {
    const payload = buildAnthropicPayload({
      messages: [{ role: "system", content: "System only." }],
      model: "claude-haiku-4-5",
    });
    const messages = payload.messages as Array<{ role: string }>;
    expect(messages[0].role).toBe("user");
  });
});

describe("isSamplingParamSupported", () => {
  it("rejects fable/opus-4.7/4.8 prefixes, accepts haiku", () => {
    expect(isSamplingParamSupported("claude-fable-5")).toBe(false);
    expect(isSamplingParamSupported("claude-opus-4-8")).toBe(false);
    expect(isSamplingParamSupported("claude-haiku-4-5")).toBe(true);
    expect(isSamplingParamSupported("claude-haiku-4-5-20251001")).toBe(true);
  });
});

// ─── 2. Response mapping ──────────────────────────────────────────────────────

describe("mapAnthropicResponse", () => {
  const baseResponse = {
    id: "msg_1",
    model: "claude-fable-5",
    stop_reason: "end_turn",
    content: [{ type: "text", text: '{"verdict":"ok"}' }],
    usage: { input_tokens: 100, output_tokens: 50 },
  };

  it("maps usage into OpenAI-shaped fields", () => {
    const result = mapAnthropicResponse(baseResponse, false);
    expect(result.usage).toEqual({ prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 });
    expect(result.model).toBe("claude-fable-5");
    expect(result.choices[0].message.content).toBe('{"verdict":"ok"}');
    expect(result.choices[0].finish_reason).toBe("end_turn");
  });

  it("strips markdown fences when a schema was requested", () => {
    const fenced = {
      ...baseResponse,
      content: [{ type: "text", text: '```json\n{"verdict":"ok"}\n```' }],
    };
    const result = mapAnthropicResponse(fenced, true);
    expect(result.choices[0].message.content).toBe('{"verdict":"ok"}');
  });

  it("throws AnthropicRefusalError on stop_reason refusal", () => {
    const refusal = { ...baseResponse, stop_reason: "refusal" };
    expect(() => mapAnthropicResponse(refusal, false)).toThrow(AnthropicRefusalError);
  });

  it("throws AnthropicRefusalError on empty content", () => {
    const empty = { ...baseResponse, content: [] };
    expect(() => mapAnthropicResponse(empty, false)).toThrow(AnthropicRefusalError);
  });
});

describe("stripJsonFences", () => {
  it("strips ```json fences", () => {
    expect(stripJsonFences('```json\n{"a":1}\n```')).toBe('{"a":1}');
  });
  it("strips bare ``` fences", () => {
    expect(stripJsonFences('```\n{"a":1}\n```')).toBe('{"a":1}');
  });
  it("leaves unfenced JSON alone", () => {
    expect(stripJsonFences('{"a":1}')).toBe('{"a":1}');
  });
});

// ─── 3. invokeCompletion dispatch + fallback ──────────────────────────────────

describe("invokeCompletion fallback", () => {
  const forgeResponse = {
    id: "forge_1",
    created: 0,
    model: "gemini-2.5-flash",
    choices: [{ index: 0, message: { role: "assistant", content: "forge answer" }, finish_reason: "stop" }],
    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
  };

  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.stubEnv("BUILT_IN_FORGE_API_KEY", "forge-test-key");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("degrades to forge when ANTHROPIC_API_KEY is missing", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const fetchMock = vi.fn(async (url: RequestInfo | URL) => {
      expect(String(url)).toContain("forge.manus.im");
      return new Response(JSON.stringify(forgeResponse), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const { invokeCompletion } = await import("../_core/llm");
    const result = await invokeCompletion({
      provider: "anthropic",
      model: "claude-fable-5",
      messages: [{ role: "user", content: "hi" }],
    });
    expect(result.model).toBe("gemini-2.5-flash");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("degrades to forge when the Anthropic call fails", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test");
    const fetchMock = vi.fn(async (url: RequestInfo | URL) => {
      if (String(url).includes("api.anthropic.com")) {
        return new Response("overloaded", { status: 529, statusText: "Overloaded" });
      }
      return new Response(JSON.stringify(forgeResponse), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const { invokeCompletion } = await import("../_core/llm");
    const result = await invokeCompletion({
      provider: "anthropic",
      model: "claude-fable-5",
      messages: [{ role: "user", content: "hi" }],
    });
    expect(result.model).toBe("gemini-2.5-flash");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns the Anthropic result when the call succeeds", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test");
    const anthropicResponse = {
      id: "msg_ok",
      model: "claude-fable-5",
      stop_reason: "end_turn",
      content: [{ type: "text", text: "fable answer" }],
      usage: { input_tokens: 20, output_tokens: 10 },
    };
    const fetchMock = vi.fn(async (url: RequestInfo | URL) => {
      expect(String(url)).toContain("api.anthropic.com");
      return new Response(JSON.stringify(anthropicResponse), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const { invokeCompletion } = await import("../_core/llm");
    const result = await invokeCompletion({
      provider: "anthropic",
      model: "claude-fable-5",
      messages: [{ role: "user", content: "hi" }],
    });
    expect(result.model).toBe("claude-fable-5");
    expect(result.choices[0].message.content).toBe("fable answer");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("routes manus_builtin straight to the forge with profile params applied", async () => {
    const fetchMock = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      expect(String(url)).toContain("forge.manus.im");
      const body = JSON.parse(String(init?.body));
      expect(body.max_tokens).toBe(4096);
      expect(body.temperature).toBe(0.3);
      expect(body).not.toHaveProperty("thinking");
      return new Response(JSON.stringify(forgeResponse), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const { invokeCompletion } = await import("../_core/llm");
    await invokeCompletion({
      provider: "manus_builtin",
      messages: [{ role: "user", content: "hi" }],
      maxTokens: 4096,
      temperature: 0.3,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

// ─── 4. Per-model pricing ─────────────────────────────────────────────────────

describe("estimateCost per-model pricing", () => {
  it("prices claude-fable-5 at $10/$50 per MTok", () => {
    expect(estimateCost(1_000_000, 0, "claude-fable-5")).toBeCloseTo(10);
    expect(estimateCost(0, 1_000_000, "claude-fable-5")).toBeCloseTo(50);
  });

  it("prefix-matches dated model ids", () => {
    expect(estimateCost(1_000_000, 0, "claude-haiku-4-5-20251001")).toBeCloseTo(1);
  });

  it("prices gemini-2.5-flash", () => {
    expect(estimateCost(1_000_000, 1_000_000, "gemini-2.5-flash")).toBeCloseTo(2.8);
  });

  it("keeps the legacy conservative rate when no model is given", () => {
    expect(estimateCost(1_000_000, 1_000_000)).toBeCloseTo(20);
  });

  it("prices embeddings", () => {
    expect(estimateCost(1_000_000, 0, "text-embedding-3-small")).toBeCloseTo(0.02);
  });
});

// ─── 5. models.yaml task tiers ────────────────────────────────────────────────

describe("models.yaml task tiers", () => {
  it("planner routes to anthropic/claude-fable-5 without a temperature", () => {
    const cfg = getCompletionConfig("planner");
    expect(cfg.provider).toBe("anthropic");
    expect(cfg.model).toBe("claude-fable-5");
    expect(cfg.temperature).toBeUndefined();
    expect(cfg.max_tokens).toBe(8192);
  });

  it("extraction and structured route to anthropic/claude-haiku-4-5", () => {
    expect(getCompletionConfig("extraction").model).toBe("claude-haiku-4-5");
    expect(getCompletionConfig("structured").model).toBe("claude-haiku-4-5");
  });

  it("worker stays on the forge", () => {
    const cfg = getCompletionConfig("worker");
    expect(cfg.provider).toBe("manus_builtin");
    expect(cfg.model).toBe("auto");
  });

  it("planner budget envelope is large enough for Fable pricing", () => {
    const budget = getBudgetDefaults("planner");
    expect(budget.soft_cap_usd).toBeGreaterThanOrEqual(0.5);
    expect(budget.max_input_tokens).toBeGreaterThanOrEqual(16000);
    // Sanity: a full planner call must clear its own soft cap check
    const worstCase = estimateCost(budget.max_input_tokens, 1000, "claude-fable-5");
    expect(worstCase).toBeLessThan(budget.soft_cap_usd);
  });
});
