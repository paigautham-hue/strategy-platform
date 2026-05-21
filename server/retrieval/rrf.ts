/**
 * Reciprocal Rank Fusion — IMPLEMENTATION_PLAN.md Workstream 1.3, technique T7
 *
 * Fuses several independently-ranked lists (dense vector, BM25 keyword,
 * graph-hop) into one ranking, without needing the lists to share a score
 * scale. Per MEMORY_AND_LEARNING_REVIEW.md: start with FIXED weights (k=60,
 * the standard) — do not learn weights until there are ≥1000 labelled
 * queries (anti-pattern AP7).
 *
 * Score of an item d:  RRF(d) = Σ_lists  1 / (k + rank_i(d))
 * where rank_i(d) is d's 1-based position in list i (absent ⇒ contributes 0).
 *
 * Pure function. No DB, no LLM.
 */

/** Any item that can be identified across ranking lists. */
export interface Identifiable {
  id: string | number;
}

export interface RrfResult<T> {
  item: T;
  /** Fused RRF score — higher is better. */
  score: number;
  /** Number of input lists this item appeared in (useful for diagnostics). */
  listHits: number;
}

export interface RrfOptions {
  /**
   * Rank-fusion constant. The standard value is 60; larger k flattens the
   * contribution of top ranks. Must be > 0.
   */
  k?: number;
  /**
   * Optional per-list weights, parallel to the `rankings` array. A list with
   * weight 0 is ignored; default weight is 1. Use sparingly — fixed equal
   * weights are the right default until labelled data exists (AP7).
   */
  weights?: number[];
}

const DEFAULT_K = 60;

/**
 * Fuse multiple ranked lists into one ranking via Reciprocal Rank Fusion.
 *
 * Items are matched across lists by `.id`. The first time an item is seen it
 * is captured and reused, so the returned `item` is whichever object instance
 * appeared earliest across the input lists.
 *
 * @param rankings  Each inner array is one ranked list, best item first.
 * @param options   `k` (default 60) and optional per-list `weights`.
 * @returns Items sorted by fused score, descending. Ties broken by `listHits`
 *          (more agreement first) then by id for determinism.
 */
export function reciprocalRankFusion<T extends Identifiable>(
  rankings: ReadonlyArray<ReadonlyArray<T>>,
  options: RrfOptions = {},
): Array<RrfResult<T>> {
  const k = options.k ?? DEFAULT_K;
  if (!(k > 0) || !Number.isFinite(k)) {
    throw new Error(`reciprocalRankFusion: k must be a positive finite number, got ${k}`);
  }
  if (options.weights && options.weights.length !== rankings.length) {
    throw new Error(
      `reciprocalRankFusion: weights length (${options.weights.length}) ` +
        `must match rankings length (${rankings.length})`,
    );
  }

  const acc = new Map<string | number, RrfResult<T>>();

  rankings.forEach((list, listIndex) => {
    const weight = options.weights ? options.weights[listIndex] : 1;
    if (weight === 0) return;
    list.forEach((item, position) => {
      const rank = position + 1; // 1-based
      const contribution = weight / (k + rank);
      const existing = acc.get(item.id);
      if (existing) {
        existing.score += contribution;
        existing.listHits += 1;
      } else {
        acc.set(item.id, { item, score: contribution, listHits: 1 });
      }
    });
  });

  return Array.from(acc.values()).sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.listHits !== a.listHits) return b.listHits - a.listHits;
    // Final deterministic tiebreak by id.
    return String(a.item.id).localeCompare(String(b.item.id));
  });
}
