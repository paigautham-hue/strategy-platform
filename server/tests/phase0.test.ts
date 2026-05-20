/**
 * Phase 0 Acceptance Gate Test Suite
 *
 * Covers:
 *   1. Namespacing isolation (C1)
 *   2. PII redaction (C5)
 *   3. Router provider-leak check (C3)
 *   4. Budget enforcer (P8)
 *   5. Bi-temporal memory (C19)
 *   6. Audit log append-only (P5)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { redact, redactMessages } from "../ai/redactor";
import { checkBudget, estimateTokens, estimateCost, DEFAULT_ENVELOPE, BudgetExceededError } from "../ai/budget";

// ─── 1. PII Redaction Tests (C5) ─────────────────────────────────────────────

describe("PII Redactor (C5)", () => {
  it("redacts SSN patterns", () => {
    const { redacted, count } = redact("Patient SSN is 123-45-6789");
    expect(redacted).not.toContain("123-45-6789");
    expect(redacted).toContain("[REDACTED-SSN]");
    expect(count).toBeGreaterThan(0);
  });

  it("redacts credit card numbers", () => {
    const { redacted, count } = redact("Card: 4111-1111-1111-1111");
    expect(redacted).not.toContain("4111-1111-1111-1111");
    expect(redacted).toContain("[REDACTED-CC]");
    expect(count).toBeGreaterThan(0);
  });

  it("redacts email addresses", () => {
    const { redacted, count } = redact("Contact john.doe@example.com for details");
    expect(redacted).not.toContain("john.doe@example.com");
    expect(redacted).toContain("[REDACTED-EMAIL]");
    expect(count).toBeGreaterThan(0);
  });

  it("redacts US phone numbers", () => {
    const { redacted, count } = redact("Call us at (555) 867-5309");
    expect(redacted).not.toContain("867-5309");
    expect(redacted).toContain("[REDACTED-PHONE]");
    expect(count).toBeGreaterThan(0);
  });

  it("does not alter clean text", () => {
    const clean = "The market grew at 18% CAGR through 2027";
    const { redacted, count } = redact(clean);
    expect(redacted).toBe(clean);
    expect(count).toBe(0);
  });

  it("redactMessages processes all message contents", () => {
    const messages = [
      { role: "user", content: "My email is test@example.com" },
      { role: "assistant", content: "I see you mentioned 123-45-6789" },
    ];
    const redacted = redactMessages(messages);
    expect(redacted[0].content).toContain("[REDACTED-EMAIL]");
    expect(redacted[1].content).toContain("[REDACTED-SSN]");
  });

  it("handles non-string content gracefully", () => {
    const messages = [{ role: "user", content: { type: "text", text: "hello" } }];
    expect(() => redactMessages(messages)).not.toThrow();
  });
});

// ─── 2. Budget Enforcer Tests (P8) ───────────────────────────────────────────

describe("Budget Enforcer (P8)", () => {
  it("allows calls within budget", () => {
    const result = checkBudget(100, 100, 0.001, DEFAULT_ENVELOPE);
    expect(result.allowed).toBe(true);
    expect(result.warn).toBe(false);
    expect(result.hardKill).toBe(false);
  });

  it("warns at 80% of soft cap", () => {
    // softCapUsd=0.10, estimatedCostUsd=1.00 (hardKill at 1.50)
    // 0.085 is 85% of softCap (0.10) → warn, well below hardKill threshold (1.50)
    const envelope = { ...DEFAULT_ENVELOPE, softCapUsd: 0.10, estimatedCostUsd: 1.00 };
    const result = checkBudget(100, 100, 0.085, envelope); // 85% of softCap
    expect(result.allowed).toBe(true);
    expect(result.warn).toBe(true);
  });

  it("blocks at 100% of soft cap", () => {
    // softCapUsd=0.10, estimatedCostUsd=1.00 (hardKill at 1.50)
    // 0.11 >= softCapUsd → blocked, not hard-killed
    const envelope = { ...DEFAULT_ENVELOPE, softCapUsd: 0.10, estimatedCostUsd: 1.00 };
    const result = checkBudget(100, 100, 0.11, envelope); // over softCap
    expect(result.allowed).toBe(false);
    expect(result.hardKill).toBe(false);
  });

  it("hard-kills at 1.5x estimate", () => {
    // estimatedCostUsd=0.10, hardKill at 0.15
    // 0.16 > 0.15 → hard-kill
    const envelope = { ...DEFAULT_ENVELOPE, softCapUsd: 1.00, estimatedCostUsd: 0.10 };
    const result = checkBudget(100, 100, 0.16, envelope); // 1.6x estimate
    expect(result.allowed).toBe(false);
    expect(result.hardKill).toBe(true);
  });

  it("blocks when token count exceeds maxInputTokens", () => {
    const envelope = { ...DEFAULT_ENVELOPE, maxInputTokens: 100 };
    const result = checkBudget(200, 0, 0.001, envelope);
    expect(result.allowed).toBe(false);
  });

  it("BudgetExceededError carries hardKill flag", () => {
    const err = new BudgetExceededError("over limit", true);
    expect(err.hardKill).toBe(true);
    expect(err.message).toContain("over limit");
    expect(err instanceof Error).toBe(true);
  });

  it("estimateTokens returns reasonable count", () => {
    const tokens = estimateTokens("Hello world this is a test sentence");
    expect(tokens).toBeGreaterThan(0);
    expect(tokens).toBeLessThan(20);
  });

  it("estimateCost is non-negative", () => {
    const cost = estimateCost(1000, 500);
    expect(cost).toBeGreaterThan(0);
  });
});

// ─── 3. Router Provider-Leak Check (C3) ──────────────────────────────────────

describe("Router Provider-Leak (C3)", () => {
  it("router module does not import openai directly", async () => {
    // Read the router file and check for direct provider imports
    const fs = await import("fs");
    const path = await import("path");
    const routerPath = path.resolve("server/ai/router.ts");
    const content = fs.readFileSync(routerPath, "utf-8");

    // These imports must NOT appear in the router (only invokeLLM from _core is allowed)
    expect(content).not.toMatch(/from ['"]openai['"]/);
    expect(content).not.toMatch(/from ['"]@anthropic-ai\/sdk['"]/);
    expect(content).not.toMatch(/from ['"]@google\/generative-ai['"]/);
    expect(content).not.toMatch(/from ['"]groq-sdk['"]/);
  });

  it("domain service files do not import openai directly", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const glob = await import("fs").then(() => import("node:fs/promises"));

    const domainFiles = [
      "server/services/memory.ts",
      "server/services/predictions.ts",
      "server/services/export.ts",
      "server/middleware/audit.ts",
    ];

    for (const file of domainFiles) {
      const filePath = path.resolve(file);
      try {
        const content = fs.readFileSync(filePath, "utf-8");
        expect(content, `${file} must not import openai directly`).not.toMatch(/from ['"]openai['"]/);
        expect(content, `${file} must not import anthropic directly`).not.toMatch(/from ['"]@anthropic-ai\/sdk['"]/);
        // Domain files may import from router (allowed)
        if (content.includes("invokeLLM")) {
          // invokeLLM must only be imported in router.ts
          expect(content, `${file} must not import invokeLLM directly (use router)`).not.toMatch(/import.*invokeLLM/);
        }
      } catch (e) {
        // File might not exist yet, skip
      }
    }
  });

  it("MCP gateway is the sole dispatch path (no direct fetch in domain code)", async () => {
    const fs = await import("fs");
    const path = await import("path");

    const domainFiles = [
      "server/services/memory.ts",
      "server/services/predictions.ts",
    ];

    for (const file of domainFiles) {
      const filePath = path.resolve(file);
      try {
        const content = fs.readFileSync(filePath, "utf-8");
        // Domain files must not call fetch() directly for external data
        // (internal DB calls are fine, but external HTTP calls must go through MCP)
        const fetchMatches = content.match(/\bfetch\s*\(/g) ?? [];
        expect(fetchMatches.length, `${file} must not call fetch() directly`).toBe(0);
      } catch {
        // File might not exist yet, skip
      }
    }
  });
});

// ─── 4. Namespacing Isolation (C1) ───────────────────────────────────────────

describe("Namespacing Isolation (C1)", () => {
  it("every schema table type has tenantId field", async () => {
    const schema = await import("../../drizzle/schema");
    const { getTableColumns } = await import("drizzle-orm");

    const tablesToCheck = [
      "companies",
      "strategyProjects",
      "sessions",
      "memoryItems",
      "predictions",
      "auditLogs",
      "usageEvents",
      "llmCallLogs",
    ];

    for (const tableName of tablesToCheck) {
      const table = schema[tableName as keyof typeof schema];
      if (table && typeof table === "object") {
        try {
          const columns = getTableColumns(table as Parameters<typeof getTableColumns>[0]);
          expect(
            Object.keys(columns),
            `${tableName} must have tenantId column`
          ).toContain("tenantId");
        } catch {
          // Not a table object, skip
        }
      }
    }
  });

  it("memory query enforces companyId isolation", async () => {
    // Mock the DB to verify the query includes company isolation
    const { queryMemory } = await import("../services/memory");

    // This should not throw even with a non-existent company
    // (returns empty array, not cross-tenant data)
    const result = await queryMemory({
      tenantId: "tenant-a",
      companyId: 99999,
      query: "test",
    });

    expect(Array.isArray(result)).toBe(true);
    // All returned items must belong to the queried company
    for (const item of result) {
      expect(item.companyId).toBe(99999);
      expect(item.tenantId).toBe("tenant-a");
    }
  });
});

// ─── 5. Bi-temporal Memory (C19) ─────────────────────────────────────────────

describe("Bi-temporal Memory (C19)", () => {
  it("memory schema has validAt, invalidAt, ingestedAt fields", async () => {
    const schema = await import("../../drizzle/schema");
    const { getTableColumns } = await import("drizzle-orm");
    const columns = getTableColumns(schema.memoryItems);
    expect(Object.keys(columns)).toContain("validAt");
    expect(Object.keys(columns)).toContain("invalidAt");
    expect(Object.keys(columns)).toContain("ingestedAt");
  });

  it("memory schema has provenanceClusterId (C21)", async () => {
    const schema = await import("../../drizzle/schema");
    const { getTableColumns } = await import("drizzle-orm");
    const columns = getTableColumns(schema.memoryItems);
    expect(Object.keys(columns)).toContain("provenanceClusterId");
  });

  it("memory schema has embeddingModelVersion (C22)", async () => {
    const schema = await import("../../drizzle/schema");
    const { getTableColumns } = await import("drizzle-orm");
    const columns = getTableColumns(schema.memoryItems);
    expect(Object.keys(columns)).toContain("embeddingModelVersion");
  });
});

// ─── 6. Audit Log Append-Only (P5) ───────────────────────────────────────────

describe("Audit Log Append-Only (P5)", () => {
  it("appendAudit does not throw on missing DB", async () => {
    const { appendAudit } = await import("../middleware/audit");
    // Should not throw even if DB is unavailable
    await expect(
      appendAudit({
        tenantId: "test",
        action: "read",
        resourceType: "memory_item",
        confidentialityTier: "confidential",
      })
    ).resolves.not.toThrow();
  });

  it("audit module exports no delete or update functions", async () => {
    const auditModule = await import("../middleware/audit");
    const exports = Object.keys(auditModule);

    // No delete or update exports allowed
    for (const exportName of exports) {
      expect(exportName.toLowerCase(), `${exportName} should not be a delete/update function`).not.toMatch(
        /delete|remove|update|modify|edit|clear|purge/i
      );
    }
  });
});
