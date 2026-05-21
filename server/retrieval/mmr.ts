/**
 * Maximal Marginal Relevance — IMPLEMENTATION_PLAN.md Workstream 1.3, technique T7
 *
 * Re-ranks candidates to balance relevance to the query against diversity,
 * so the top-K is not five near-duplicate facts. Per
 * MEMORY_AND_LEARNING_REVIEW.md (E3): applied AFTER cross-encoder rerank,
 * with λ ≈ 0.5. Critical for cross-portco retrieval.
 *
 * At each step pick the candidate c maximising:
 *     λ · sim(c, query)  −  (1 − λ) · max_{s ∈ selected} sim(c, s)
 *
 * Pure function. No DB, no LLM.
 */

import { cosineSimilarity } from "./cosine";

/** A retrieval candidate with its embedding vector. */
export interface MmrCandidate<T> {
  item: T;
  embedding: readonly number[];
}

export interface MmrOptions {
  /**
   * Relevance/diversity trade-off in [0, 1].
   *   1.0 = pure relevance (ignores diversity)
   *   0.0 = pure diversity (ignores the query)
   * Default 0.5 per the memory/learning review.
   */
  lambda?: number;
  /** Maximum number of items to return. Default: all candidates. */
  k?: number;
}

const DEFAULT_LAMBDA = 0.5;

/**
 * Diversify a candidate set with Maximal Marginal Relevance.
 *
 * @param queryEmbedding  The query vector.
 * @param candidates      Candidates with embeddings. Order is irrelevant —
 *                        MMR re-orders from scratch.
 * @param options         `lambda` (default 0.5) and `k` (default: all).
 * @returns The selected items, in MMR selection order (best first).
 */
export function maximalMarginalRelevance<T>(
  queryEmbedding: readonly number[],
  candidates: ReadonlyArray<MmrCandidate<T>>,
  options: MmrOptions = {},
): T[] {
  const lambda = options.lambda ?? DEFAULT_LAMBDA;
  if (lambda < 0 || lambda > 1 || !Number.isFinite(lambda)) {
    throw new Error(`maximalMarginalRelevance: lambda must be in [0, 1], got ${lambda}`);
  }
  const k = options.k ?? candidates.length;
  if (candidates.length === 0 || k <= 0) return [];

  // Precompute relevance (similarity to the query) for every candidate once.
  const relevance = candidates.map((c) => cosineSimilarity(queryEmbedding, c.embedding));

  const remaining = new Set<number>(candidates.map((_, i) => i));
  const selected: number[] = [];

  while (selected.length < k && remaining.size > 0) {
    let bestIndex = -1;
    let bestScore = -Infinity;

    for (const idx of Array.from(remaining)) {
      // Diversity penalty = highest similarity to anything already selected.
      let maxSimToSelected = 0;
      for (const selIdx of selected) {
        const sim = cosineSimilarity(
          candidates[idx].embedding,
          candidates[selIdx].embedding,
        );
        if (sim > maxSimToSelected) maxSimToSelected = sim;
      }

      const mmrScore = lambda * relevance[idx] - (1 - lambda) * maxSimToSelected;

      if (mmrScore > bestScore) {
        bestScore = mmrScore;
        bestIndex = idx;
      }
    }

    if (bestIndex === -1) break; // defensive — should not happen
    selected.push(bestIndex);
    remaining.delete(bestIndex);
  }

  return selected.map((i) => candidates[i].item);
}
