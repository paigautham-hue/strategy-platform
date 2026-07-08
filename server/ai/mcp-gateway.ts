/**
 * MCP Gateway — C3, P4
 *
 * Declarative tool registry + dispatch layer.
 * ALL tool calls must go through mcp.dispatch().
 * Direct fetch() calls in domain code are prohibited.
 *
 * Registered tools (Phase 0):
 *   - web_search
 *   - web_fetch
 *   - edgar_filings
 *   - lookup_memory
 */

import type { RouterContext } from "./router";
import { getDb } from "../db";
import { memoryItems } from "../../drizzle/schema";
import { and, eq, isNull } from "drizzle-orm";
import { appendAudit } from "../middleware/audit";

// ─── Tool Registry Types ──────────────────────────────────────────────────────

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (input: unknown, ctx: RouterContext) => Promise<unknown>;
}

export interface DispatchResult {
  toolName: string;
  success: boolean;
  output?: unknown;
  error?: string;
  latencyMs: number;
}

// ─── Tool Implementations ─────────────────────────────────────────────────────

async function webSearchHandler(
  input: { query: string; maxResults?: number },
  _ctx: RouterContext
): Promise<{ results: Array<{ title: string; url: string; snippet: string }> }> {
  // Use Manus built-in data API for web search
  const apiUrl = process.env.BUILT_IN_FORGE_API_URL;
  const apiKey = process.env.BUILT_IN_FORGE_API_KEY;

  if (!apiUrl || !apiKey) {
    throw new Error("web_search: BUILT_IN_FORGE_API_URL or BUILT_IN_FORGE_API_KEY not configured");
  }

  const response = await fetch(`${apiUrl}/v1/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      query: input.query,
      max_results: input.maxResults ?? 5,
    }),
  });

  if (!response.ok) {
    throw new Error(`web_search: API returned ${response.status}`);
  }

  const data = await response.json() as { results?: Array<{ title: string; url: string; snippet: string }> };
  return { results: data.results ?? [] };
}

async function webFetchHandler(
  input: { url: string; extractText?: boolean },
  _ctx: RouterContext
): Promise<{ content: string; url: string; statusCode: number }> {
  const response = await fetch(input.url, {
    headers: {
      "User-Agent": "StrategyPlatform/1.0 (research bot)",
    },
    signal: AbortSignal.timeout(15_000),
  });

  const text = await response.text();
  // Basic HTML stripping if extractText is true
  const content = input.extractText
    ? text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 10_000)
    : text.slice(0, 10_000);

  return { content, url: input.url, statusCode: response.status };
}

async function edgarFilingsHandler(
  input: { ticker?: string; cik?: string; formType?: string; limit?: number },
  _ctx: RouterContext
): Promise<{ filings: Array<{ form: string; date: string; url: string; description: string }> }> {
  // EDGAR full-text search API (public, no auth required)
  const cik = input.cik ?? input.ticker;
  if (!cik) throw new Error("edgar_filings: ticker or cik required");

  const formType = input.formType ?? "10-K";
  const limit = input.limit ?? 5;

  const url = `https://efts.sec.gov/LATEST/search-index?q=%22${encodeURIComponent(cik)}%22&dateRange=custom&startdt=2020-01-01&forms=${formType}&hits.hits._source=period_of_report,file_date,form_type,display_names,file_num`;

  const response = await fetch(url, {
    headers: { "User-Agent": "StrategyPlatform research@example.com" },
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    return { filings: [] };
  }

  const data = await response.json() as { hits?: { hits?: Array<{ _source: { form_type: string; file_date: string; file_num: string; display_names: string } }> } };
  const hits = data.hits?.hits ?? [];

  return {
    filings: hits.slice(0, limit).map((h) => ({
      form: h._source.form_type,
      date: h._source.file_date,
      url: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&filenum=${h._source.file_num}`,
      description: h._source.display_names ?? "",
    })),
  };
}

async function lookupMemoryHandler(
  input: { query: string; limit?: number },
  ctx: RouterContext
): Promise<{ memories: Array<{ id: number; canonicalForm: string; confidence: number; validAt: Date }> }> {
  if (!ctx.companyId) {
    throw new Error("lookup_memory: companyId required in context");
  }

  const db = await getDb();
  if (!db) return { memories: [] };

  // C1: Enforce company-scoped isolation on every memory read
  const rows = await db
    .select({
      id: memoryItems.id,
      canonicalForm: memoryItems.canonicalForm,
      confidence: memoryItems.confidence,
      validAt: memoryItems.validAt,
    })
    .from(memoryItems)
    .where(
      and(
        eq(memoryItems.tenantId, ctx.tenantId),
        eq(memoryItems.companyId, ctx.companyId),
        isNull(memoryItems.invalidAt), // C19: only currently valid items
        eq(memoryItems.quarantined, false)
      )
    )
    .limit(input.limit ?? 10);

  // Simple keyword filter (Phase 0; replace with vector search in Phase 1)
  const queryLower = input.query.toLowerCase();
  const filtered = rows.filter((r) =>
    r.canonicalForm.toLowerCase().includes(queryLower)
  );

  // C6: MCP memory reads are confidential reads — audit like every other path.
  void appendAudit({
    tenantId: ctx.tenantId,
    companyId: ctx.companyId,
    projectId: ctx.projectId,
    userId: ctx.userId,
    action: "read",
    resourceType: "memory_item",
    resourceId: `mcp-lookup:${input.query.slice(0, 80)}`,
    confidentialityTier: "confidential",
    traceId: ctx.traceId,
    metadata: { tool: "lookup_memory", results: filtered.length },
  });

  return { memories: filtered };
}

// ─── Tool Registry ────────────────────────────────────────────────────────────

const TOOL_REGISTRY = new Map<string, ToolDefinition>();

function registerTool(tool: ToolDefinition) {
  TOOL_REGISTRY.set(tool.name, tool);
}

// Register all Phase 0 tools
registerTool({
  name: "web_search",
  description: "Search the web for information using a query string",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "The search query" },
      maxResults: { type: "number", description: "Max results to return (default 5)" },
    },
    required: ["query"],
  },
  handler: webSearchHandler as (input: unknown, ctx: RouterContext) => Promise<unknown>,
});

registerTool({
  name: "web_fetch",
  description: "Fetch the content of a URL",
  inputSchema: {
    type: "object",
    properties: {
      url: { type: "string", description: "The URL to fetch" },
      extractText: { type: "boolean", description: "Strip HTML tags and return plain text" },
    },
    required: ["url"],
  },
  handler: webFetchHandler as (input: unknown, ctx: RouterContext) => Promise<unknown>,
});

registerTool({
  name: "edgar_filings",
  description: "Look up SEC EDGAR filings for a company by ticker or CIK",
  inputSchema: {
    type: "object",
    properties: {
      ticker: { type: "string", description: "Stock ticker symbol" },
      cik: { type: "string", description: "SEC CIK number" },
      formType: { type: "string", description: "Form type (e.g. 10-K, 10-Q, 8-K)" },
      limit: { type: "number", description: "Max filings to return" },
    },
  },
  handler: edgarFilingsHandler as (input: unknown, ctx: RouterContext) => Promise<unknown>,
});

registerTool({
  name: "lookup_memory",
  description: "Look up memory items for the current company by keyword query",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Keyword query to search memory" },
      limit: { type: "number", description: "Max items to return" },
    },
    required: ["query"],
  },
  handler: lookupMemoryHandler as (input: unknown, ctx: RouterContext) => Promise<unknown>,
});

// ─── Dispatch ─────────────────────────────────────────────────────────────────

/**
 * Dispatch a tool call through the MCP gateway.
 * This is the ONLY permitted path for tool execution in domain code.
 */
export async function dispatch(
  toolName: string,
  input: unknown,
  ctx: RouterContext
): Promise<DispatchResult> {
  const tool = TOOL_REGISTRY.get(toolName);
  if (!tool) {
    return {
      toolName,
      success: false,
      error: `Unknown tool: ${toolName}. Registered tools: ${Array.from(TOOL_REGISTRY.keys()).join(", ")}`,
      latencyMs: 0,
    };
  }

  const start = Date.now();
  try {
    const output = await tool.handler(input, ctx);
    return {
      toolName,
      success: true,
      output,
      latencyMs: Date.now() - start,
    };
  } catch (err) {
    return {
      toolName,
      success: false,
      error: err instanceof Error ? err.message : String(err),
      latencyMs: Date.now() - start,
    };
  }
}

/**
 * Get all registered tool definitions (for LLM tool-calling schemas).
 */
export function getToolDefinitions(): ToolDefinition[] {
  return Array.from(TOOL_REGISTRY.values());
}

/**
 * Get a single tool definition by name.
 */
export function getTool(name: string): ToolDefinition | undefined {
  return TOOL_REGISTRY.get(name);
}
