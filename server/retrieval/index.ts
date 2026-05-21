/**
 * Retrieval primitives — IMPLEMENTATION_PLAN.md Workstream 1.3
 *
 * Pure, DB-free building blocks for hybrid retrieval:
 *   - cosine: vector similarity
 *   - rrf:    Reciprocal Rank Fusion of multiple ranked lists
 *   - mmr:    Maximal Marginal Relevance for diversity
 *
 * The hybrid retrieval pipeline (RRF fuse → cross-encoder rerank → MMR)
 * composes these. Rerank lands when an embedding/rerank provider is wired.
 */

export { dot, magnitude, cosineSimilarity, cosineDistance } from "./cosine";
export {
  reciprocalRankFusion,
  type Identifiable,
  type RrfResult,
  type RrfOptions,
} from "./rrf";
export {
  maximalMarginalRelevance,
  type MmrCandidate,
  type MmrOptions,
} from "./mmr";
