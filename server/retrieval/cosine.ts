/**
 * Vector similarity primitives — IMPLEMENTATION_PLAN.md Workstream 1.3
 *
 * Pure functions. No DB, no LLM. Used by the app-side similarity search
 * (OD2: MySQL `json` embedding column + app-side cosine for Phase 0) and
 * by Maximal Marginal Relevance (mmr.ts).
 *
 * Migrate to a native vector index (MySQL 9 VECTOR or Zep) in Phase 1 — but
 * the cosine definition here stays the canonical reference implementation.
 */

/** Dot product of two equal-length vectors. */
export function dot(a: readonly number[], b: readonly number[]): number {
  if (a.length !== b.length) {
    throw new Error(`dot: vector length mismatch (${a.length} vs ${b.length})`);
  }
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}

/** Euclidean (L2) magnitude of a vector. */
export function magnitude(v: readonly number[]): number {
  let sum = 0;
  for (let i = 0; i < v.length; i++) {
    sum += v[i] * v[i];
  }
  return Math.sqrt(sum);
}

/**
 * Cosine similarity in the range [-1, 1].
 *
 * A zero-magnitude vector has no direction, so similarity is defined as 0
 * (not NaN) — this keeps ranking math well-behaved when an embedding failed
 * to generate and was stored as a zero vector.
 */
export function cosineSimilarity(a: readonly number[], b: readonly number[]): number {
  if (a.length !== b.length) {
    throw new Error(`cosineSimilarity: vector length mismatch (${a.length} vs ${b.length})`);
  }
  const magA = magnitude(a);
  const magB = magnitude(b);
  if (magA === 0 || magB === 0) return 0;
  const sim = dot(a, b) / (magA * magB);
  // Guard against floating-point drift just outside [-1, 1].
  if (sim > 1) return 1;
  if (sim < -1) return -1;
  return sim;
}

/**
 * Cosine *distance* in [0, 2]: `1 - cosineSimilarity`.
 * Lower means more similar. Convenient for "nearest neighbour" ordering.
 */
export function cosineDistance(a: readonly number[], b: readonly number[]): number {
  return 1 - cosineSimilarity(a, b);
}
