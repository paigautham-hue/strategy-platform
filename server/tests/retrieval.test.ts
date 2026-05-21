/**
 * Unit tests — Retrieval primitives (server/retrieval/)
 * IMPLEMENTATION_PLAN.md Workstream 1.3
 */

import { describe, it, expect } from "vitest";
import {
  dot,
  magnitude,
  cosineSimilarity,
  cosineDistance,
  reciprocalRankFusion,
  maximalMarginalRelevance,
  type MmrCandidate,
} from "../retrieval";

// ─── cosine.ts ────────────────────────────────────────────────────────────────

describe("cosine — dot & magnitude", () => {
  it("dot product is correct", () => {
    expect(dot([1, 2, 3], [4, 5, 6])).toBe(32); // 4 + 10 + 18
  });

  it("magnitude is correct", () => {
    expect(magnitude([3, 4])).toBe(5); // 3-4-5 triangle
    expect(magnitude([0, 0, 0])).toBe(0);
  });

  it("throws on length mismatch", () => {
    expect(() => dot([1, 2], [1, 2, 3])).toThrow(/length mismatch/);
  });
});

describe("cosine — cosineSimilarity", () => {
  it("identical direction → 1", () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 10);
    expect(cosineSimilarity([1, 0], [2, 0])).toBeCloseTo(1, 10); // same direction, diff magnitude
  });

  it("orthogonal vectors → 0", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 10);
  });

  it("opposite direction → -1", () => {
    expect(cosineSimilarity([1, 2], [-1, -2])).toBeCloseTo(-1, 10);
  });

  it("zero vector → 0, never NaN", () => {
    const sim = cosineSimilarity([0, 0, 0], [1, 2, 3]);
    expect(sim).toBe(0);
    expect(Number.isNaN(sim)).toBe(false);
  });

  it("stays within [-1, 1]", () => {
    const sim = cosineSimilarity([0.1, 0.2, 0.3], [0.1, 0.2, 0.3]);
    expect(sim).toBeLessThanOrEqual(1);
    expect(sim).toBeGreaterThanOrEqual(-1);
  });

  it("throws on length mismatch", () => {
    expect(() => cosineSimilarity([1, 2], [1, 2, 3])).toThrow(/length mismatch/);
  });

  it("cosineDistance = 1 - similarity", () => {
    expect(cosineDistance([1, 0], [1, 0])).toBeCloseTo(0, 10);
    expect(cosineDistance([1, 0], [0, 1])).toBeCloseTo(1, 10);
    expect(cosineDistance([1, 0], [-1, 0])).toBeCloseTo(2, 10);
  });
});

// ─── rrf.ts ───────────────────────────────────────────────────────────────────

interface Doc {
  id: string;
}
const d = (id: string): Doc => ({ id });

describe("rrf — Reciprocal Rank Fusion", () => {
  it("a single list preserves order; scores follow 1/(k+rank)", () => {
    const result = reciprocalRankFusion([[d("a"), d("b"), d("c")]], { k: 60 });
    expect(result.map((r) => r.item.id)).toEqual(["a", "b", "c"]);
    expect(result[0].score).toBeCloseTo(1 / 61, 10); // rank 1
    expect(result[1].score).toBeCloseTo(1 / 62, 10); // rank 2
    expect(result[2].score).toBeCloseTo(1 / 63, 10); // rank 3
  });

  it("an item ranked in two lists outscores an item ranked in one", () => {
    // 'a' appears top of both lists; 'z' appears only once
    const listA = [d("a"), d("z")];
    const listB = [d("a"), d("y")];
    const result = reciprocalRankFusion([listA, listB], { k: 60 });
    expect(result[0].item.id).toBe("a");
    expect(result[0].listHits).toBe(2);
    expect(result[0].score).toBeCloseTo(1 / 61 + 1 / 61, 10);
  });

  it("a lower rank in a second list still adds to the score", () => {
    const listA = [d("a"), d("b")];
    const listB = [d("b"), d("a")];
    const result = reciprocalRankFusion([listA, listB], { k: 60 });
    // Both appear at rank 1 and rank 2 → identical fused score → tie broken by id
    expect(result.map((r) => r.item.id)).toEqual(["a", "b"]);
    expect(result[0].score).toBeCloseTo(result[1].score, 10);
  });

  it("k changes the score scale", () => {
    const small = reciprocalRankFusion([[d("a")]], { k: 1 });
    const large = reciprocalRankFusion([[d("a")]], { k: 1000 });
    expect(small[0].score).toBeCloseTo(1 / 2, 10);
    expect(large[0].score).toBeCloseTo(1 / 1001, 10);
  });

  it("a zero-weight list is ignored", () => {
    const listA = [d("a")];
    const listB = [d("b")];
    const result = reciprocalRankFusion([listA, listB], { weights: [1, 0] });
    expect(result.map((r) => r.item.id)).toEqual(["a"]);
  });

  it("throws on weights/rankings length mismatch", () => {
    expect(() =>
      reciprocalRankFusion([[d("a")]], { weights: [1, 1] }),
    ).toThrow(/weights length/);
  });

  it("throws on a non-positive k", () => {
    expect(() => reciprocalRankFusion([[d("a")]], { k: 0 })).toThrow(/k must be/);
    expect(() => reciprocalRankFusion([[d("a")]], { k: -5 })).toThrow(/k must be/);
  });

  it("empty input yields an empty ranking", () => {
    expect(reciprocalRankFusion<Doc>([])).toEqual([]);
    expect(reciprocalRankFusion<Doc>([[], []])).toEqual([]);
  });

  it("ties are broken deterministically", () => {
    const r1 = reciprocalRankFusion([[d("b"), d("a")], [d("a"), d("b")]]);
    const r2 = reciprocalRankFusion([[d("a"), d("b")], [d("b"), d("a")]]);
    expect(r1.map((r) => r.item.id)).toEqual(r2.map((r) => r.item.id));
  });
});

// ─── mmr.ts ───────────────────────────────────────────────────────────────────

const cand = <T>(item: T, embedding: number[]): MmrCandidate<T> => ({ item, embedding });

describe("mmr — Maximal Marginal Relevance", () => {
  it("lambda = 1 reduces to pure relevance ranking", () => {
    const query = [1, 0];
    const candidates = [
      cand("low", [0, 1]), // orthogonal → relevance 0
      cand("high", [1, 0]), // identical → relevance 1
      cand("mid", [1, 1]), // 45° → relevance ~0.707
    ];
    const result = maximalMarginalRelevance(query, candidates, { lambda: 1 });
    expect(result).toEqual(["high", "mid", "low"]);
  });

  it("k caps the number of results", () => {
    const query = [1, 0];
    const candidates = [
      cand("a", [1, 0]),
      cand("b", [0.9, 0.1]),
      cand("c", [0.8, 0.2]),
    ];
    const result = maximalMarginalRelevance(query, candidates, { lambda: 1, k: 2 });
    expect(result).toHaveLength(2);
  });

  it("diversity: a near-duplicate of the top hit is demoted below a distinct item", () => {
    // Query is deliberately NOT colinear with any candidate, so similarity to
    // the selected set differs from relevance — the case where MMR earns its keep.
    const query = [1, 1];
    const candidates = [
      cand("top", [1, 0.9]), // highest relevance to the query
      cand("dup", [1, 0.85]), // near-duplicate of 'top'
      cand("diverse", [0.2, 1]), // lower relevance, but a distinct direction
    ];
    const result = maximalMarginalRelevance(query, candidates, { lambda: 0.5 });
    // 'top' is picked first (highest relevance).
    expect(result[0]).toBe("top");
    // At λ=0.5 the near-duplicate's redundancy penalty sinks it below the
    // distinct item, even though 'dup' has higher raw relevance than 'diverse'.
    expect(result[1]).toBe("diverse");
    expect(result[2]).toBe("dup");
  });

  it("empty candidate set yields an empty result", () => {
    expect(maximalMarginalRelevance([1, 0], [])).toEqual([]);
  });

  it("k <= 0 yields an empty result", () => {
    const candidates = [cand("a", [1, 0])];
    expect(maximalMarginalRelevance([1, 0], candidates, { k: 0 })).toEqual([]);
  });

  it("throws on a lambda outside [0, 1]", () => {
    const candidates = [cand("a", [1, 0])];
    expect(() => maximalMarginalRelevance([1, 0], candidates, { lambda: 1.5 })).toThrow(
      /lambda must be/,
    );
    expect(() => maximalMarginalRelevance([1, 0], candidates, { lambda: -0.1 })).toThrow(
      /lambda must be/,
    );
  });

  it("returns every candidate when k is not given", () => {
    const query = [1, 0];
    const candidates = [
      cand("a", [1, 0]),
      cand("b", [0, 1]),
      cand("c", [1, 1]),
    ];
    const result = maximalMarginalRelevance(query, candidates, { lambda: 0.5 });
    expect(result.sort()).toEqual(["a", "b", "c"]);
  });
});
