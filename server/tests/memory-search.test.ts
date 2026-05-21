/**
 * Unit tests — Hybrid Memory Search scoring helpers
 * server/services/memory-search.ts · IMPLEMENTATION_PLAN.md Workstream 1.3
 *
 * Covers the pure scoring helpers. The full hybridSearchMemory orchestration
 * (DB + embedding) runs in the integration suite.
 */

import { describe, it, expect } from "vitest";
import { queryTerms, keywordScore } from "../services/memory-search";

describe("memory-search — queryTerms", () => {
  it("lower-cases and splits on non-alphanumerics", () => {
    expect(queryTerms("Brazil B2B SaaS")).toEqual(["brazil", "b2b", "saas"]);
  });

  it("drops single-character tokens", () => {
    expect(queryTerms("a market in X")).toEqual(["market", "in"]);
  });

  it("handles punctuation and extra whitespace", () => {
    expect(queryTerms("  pricing,  margin;  CAC!  ")).toEqual(["pricing", "margin", "cac"]);
  });

  it("returns [] for an empty query", () => {
    expect(queryTerms("")).toEqual([]);
    expect(queryTerms("   ")).toEqual([]);
  });
});

describe("memory-search — keywordScore", () => {
  const terms = queryTerms("enterprise pricing strategy");

  it("counts distinct query terms present in the text", () => {
    expect(keywordScore("Our enterprise pricing needs work", terms)).toBe(2); // enterprise, pricing
    expect(keywordScore("A full pricing strategy for enterprise buyers", terms)).toBe(3);
  });

  it("is case-insensitive", () => {
    expect(keywordScore("ENTERPRISE PRICING", terms)).toBe(2);
  });

  it("does not double-count a repeated term", () => {
    expect(keywordScore("pricing pricing pricing", terms)).toBe(1);
  });

  it("returns 0 when no term matches", () => {
    expect(keywordScore("unrelated content about logistics", terms)).toBe(0);
  });

  it("returns 0 when there are no query terms", () => {
    expect(keywordScore("any text at all", [])).toBe(0);
  });
});
