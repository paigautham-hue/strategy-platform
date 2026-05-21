/**
 * models-config.ts — M1
 *
 * Loads models.yaml at startup and exposes typed accessors.
 * The router reads this module — no hardcoded model strings in router.ts.
 */

import { readFileSync } from "fs";
import { join } from "path";
import yaml from "js-yaml";

// ─── YAML shape ───────────────────────────────────────────────────────────────

interface CompletionProviderConfig {
  provider: string;
  model: string;
  max_tokens: number;
  temperature: number;
  description: string;
}

interface EmbeddingProviderConfig {
  provider: string;
  model: string;
  dimensions: number;
  status: "active" | "deferred";
  description: string;
  promotion_criteria?: string;
}

interface BudgetDefaultConfig {
  max_input_tokens: number;
  max_output_tokens: number;
  soft_cap_usd: number;
  estimated_cost_usd: number;
}

interface ModelsYaml {
  completion_providers: Record<string, CompletionProviderConfig>;
  embedding_providers: {
    active: string;
    [key: string]: EmbeddingProviderConfig | string;
  };
  budget_defaults: Record<string, BudgetDefaultConfig>;
}

// ─── Load once at module init ─────────────────────────────────────────────────

let _config: ModelsYaml | null = null;

function loadConfig(): ModelsYaml {
  if (_config) return _config;
  try {
    const yamlPath = join(process.cwd(), "server", "ai", "models.yaml");
    const raw = readFileSync(yamlPath, "utf-8");
    _config = yaml.load(raw) as ModelsYaml;
    return _config;
  } catch (err) {
    console.error("[models-config] Failed to load models.yaml:", err);
    // Return safe defaults so the server doesn't crash
    return {
      completion_providers: {
        default: { provider: "manus_builtin", model: "auto", max_tokens: 4096, temperature: 0.3, description: "fallback" },
        structured: { provider: "manus_builtin", model: "auto", max_tokens: 2048, temperature: 0.0, description: "fallback" },
        extraction: { provider: "manus_builtin", model: "auto", max_tokens: 2048, temperature: 0.1, description: "fallback" },
        creative: { provider: "manus_builtin", model: "auto", max_tokens: 8192, temperature: 0.7, description: "fallback" },
      },
      embedding_providers: {
        active: "openai-3-small",
        "openai-3-small": { provider: "openai", model: "text-embedding-3-small", dimensions: 1536, status: "active", description: "fallback" },
      },
      budget_defaults: {
        completion: { max_input_tokens: 8000, max_output_tokens: 4000, soft_cap_usd: 0.10, estimated_cost_usd: 0.05 },
        embedding: { max_input_tokens: 2000, max_output_tokens: 0, soft_cap_usd: 0.01, estimated_cost_usd: 0.002 },
        structured: { max_input_tokens: 4000, max_output_tokens: 2000, soft_cap_usd: 0.08, estimated_cost_usd: 0.04 },
        extraction: { max_input_tokens: 4000, max_output_tokens: 1000, soft_cap_usd: 0.05, estimated_cost_usd: 0.02 },
      },
    };
  }
}

// ─── Public accessors ─────────────────────────────────────────────────────────

/** Get the completion provider config for a given task type. */
export function getCompletionConfig(task: "default" | "extraction" | "structured" | "creative" = "default"): CompletionProviderConfig {
  const cfg = loadConfig();
  return cfg.completion_providers[task] ?? cfg.completion_providers["default"];
}

/** Get the active embedding provider config. */
export function getActiveEmbeddingConfig(): { key: string; config: EmbeddingProviderConfig } {
  const cfg = loadConfig();
  const activeKey = cfg.embedding_providers.active as string;
  const config = cfg.embedding_providers[activeKey] as EmbeddingProviderConfig;
  if (!config) {
    throw new Error(`[models-config] Active embedding provider '${activeKey}' not found in models.yaml`);
  }
  return { key: activeKey, config };
}

/** Get budget defaults for a given task type. */
export function getBudgetDefaults(task: "completion" | "embedding" | "structured" | "extraction" = "completion") {
  const cfg = loadConfig();
  return cfg.budget_defaults[task] ?? cfg.budget_defaults["completion"];
}

/** Expose the raw config for inspection (e.g. in tests). */
export function getRawConfig(): ModelsYaml {
  return loadConfig();
}
