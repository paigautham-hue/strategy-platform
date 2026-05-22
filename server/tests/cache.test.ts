/**
 * Unit tests — Caching Layer (server/services/cache.ts)
 * IMPLEMENTATION_PLAN.md Phase 8 / Workstream 8.1
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { TtlCache, cacheKey, embeddingCacheKey } from "../services/cache";

afterEach(() => {
  vi.useRealTimers();
});

describe("cache — TtlCache basics", () => {
  it("stores and retrieves a value", () => {
    const c = new TtlCache<number>(10, 1000);
    c.set("a", 1);
    expect(c.get("a")).toBe(1);
    expect(c.size).toBe(1);
  });

  it("returns undefined for a missing key", () => {
    const c = new TtlCache<number>(10, 1000);
    expect(c.get("nope")).toBeUndefined();
  });

  it("clears all entries", () => {
    const c = new TtlCache<number>(10, 1000);
    c.set("a", 1);
    c.clear();
    expect(c.size).toBe(0);
    expect(c.get("a")).toBeUndefined();
  });
});

describe("cache — LRU eviction", () => {
  it("evicts the least-recently-used entry at capacity", () => {
    const c = new TtlCache<number>(2, 10000);
    c.set("a", 1);
    c.set("b", 2);
    c.get("a"); // 'a' is now the most-recently-used
    c.set("c", 3); // capacity 2 → evict the LRU, which is 'b'
    expect(c.get("b")).toBeUndefined();
    expect(c.get("a")).toBe(1);
    expect(c.get("c")).toBe(3);
  });
});

describe("cache — TTL expiry", () => {
  it("expires an entry after its TTL", () => {
    vi.useFakeTimers();
    const c = new TtlCache<number>(10, 1000);
    c.set("x", 42);
    vi.advanceTimersByTime(500);
    expect(c.get("x")).toBe(42);
    vi.advanceTimersByTime(600); // total 1100ms > 1000ms TTL
    expect(c.get("x")).toBeUndefined();
  });
});

describe("cache — stats", () => {
  it("tracks hits, misses, and hit rate", () => {
    const c = new TtlCache<number>(10, 1000);
    c.set("a", 1);
    c.get("a"); // hit
    c.get("a"); // hit
    c.get("b"); // miss
    const s = c.stats();
    expect(s.hits).toBe(2);
    expect(s.misses).toBe(1);
    expect(s.hitRate).toBeCloseTo(0.6667, 3);
  });
});

describe("cache — cacheKey", () => {
  it("is deterministic and collision-resistant", () => {
    expect(cacheKey("a", 1, "b")).toBe(cacheKey("a", 1, "b"));
    expect(cacheKey("a", 1, "b")).not.toBe(cacheKey("a", 2, "b"));
  });

  it("embeddingCacheKey varies by model, dimensions, and text", () => {
    const base = embeddingCacheKey("text-embedding-3-small", 256, "hello");
    expect(base).toBe(embeddingCacheKey("text-embedding-3-small", 256, "hello"));
    expect(base).not.toBe(embeddingCacheKey("text-embedding-3-large", 256, "hello"));
    expect(base).not.toBe(embeddingCacheKey("text-embedding-3-small", 512, "hello"));
    expect(base).not.toBe(embeddingCacheKey("text-embedding-3-small", 256, "world"));
  });
});
