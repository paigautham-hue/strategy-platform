/**
 * Source Trust & Confidence Aggregation
 * IMPLEMENTATION_PLAN.md Workstream 1.4 · Critical Patterns C21, C24 · technique T12
 *
 * Three tightly-coupled jobs:
 *   - T12 — assign each source a trust prior by domain
 *   - C21 — aggregate confidence over DISTINCT sources, Bayesian-style, so the
 *           same article quoted twenty times does not inflate confidence
 *   - C24 — quarantine claims from low-trust sources until corroborated
 *
 * Pure logic. No DB, no LLM. The `source_trust_register` table seeds from
 * `SEED_SOURCE_TRUST`; runtime overrides are passed in as a Map.
 */

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/** Trust prior for a domain not present in the register. Neutral. */
export const DEFAULT_SOURCE_TRUST = 0.5;

/** Below this trust score a claim is a quarantine candidate (C24). */
export const QUARANTINE_TRUST_THRESHOLD = 0.5;

/**
 * A low-trust claim leaves quarantine once this many DISTINCT sources
 * corroborate it (C24). Two independent sources is the bar.
 */
export const QUARANTINE_MIN_CORROBORATION = 2;

/**
 * Seed trust priors. Regulatory filings and primary records score highest;
 * established press in the middle; anonymous / social at the bottom. New
 * domains inherit DEFAULT_SOURCE_TRUST until curated.
 */
export const SEED_SOURCE_TRUST: Readonly<Record<string, number>> = {
  // Primary records / regulators
  "sec.gov": 0.95,
  "europa.eu": 0.92,
  "gov.uk": 0.92,
  "companieshouse.gov.uk": 0.92,
  "federalreserve.gov": 0.93,
  "worldbank.org": 0.9,
  "imf.org": 0.9,
  // Wire services / established financial press
  "reuters.com": 0.85,
  "bloomberg.com": 0.85,
  "ft.com": 0.82,
  "wsj.com": 0.82,
  "economist.com": 0.8,
  "nytimes.com": 0.78,
  // Trade / analyst
  "gartner.com": 0.75,
  "forrester.com": 0.75,
  "techcrunch.com": 0.6,
  // User-generated / low-verification
  "reddit.com": 0.35,
  "medium.com": 0.4,
  "x.com": 0.3,
  "twitter.com": 0.3,
};

// ─────────────────────────────────────────────────────────────────────────────
// DOMAIN EXTRACTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract the registrable domain from a URL.
 *   "https://www.sec.gov/cgi-bin/browse"  → "sec.gov"
 *   "http://blog.example.co.uk/post"      → "example.co.uk"
 * Returns null when the input is not a parseable http(s) URL.
 *
 * Heuristic for the registrable part: keep the last 2 labels, except for
 * known two-level public suffixes (co.uk, gov.uk, com.au, …) where we keep 3.
 */
export function extractDomain(url: string): string | null {
  let host: string;
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    host = parsed.hostname.toLowerCase();
  } catch {
    return null;
  }
  if (!host) return null;

  const labels = host.split(".").filter(Boolean);
  if (labels.length <= 2) return labels.join(".");

  const lastTwo = labels.slice(-2).join(".");
  const TWO_LEVEL_SUFFIXES = new Set([
    "co.uk",
    "gov.uk",
    "org.uk",
    "ac.uk",
    "com.au",
    "com.br",
    "co.in",
    "co.jp",
  ]);
  if (TWO_LEVEL_SUFFIXES.has(lastTwo)) {
    return labels.slice(-3).join(".");
  }
  return lastTwo;
}

// ─────────────────────────────────────────────────────────────────────────────
// TRUST LOOKUP
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Trust prior for a domain. Checks runtime `overrides` first (loaded from the
 * `source_trust_register` table), then the seed table, then the default.
 */
export function trustScoreForDomain(
  domain: string,
  overrides?: ReadonlyMap<string, number>,
): number {
  const d = domain.trim().toLowerCase();
  if (!d) return DEFAULT_SOURCE_TRUST;
  if (overrides?.has(d)) return clamp01(overrides.get(d)!);
  if (d in SEED_SOURCE_TRUST) return SEED_SOURCE_TRUST[d];
  return DEFAULT_SOURCE_TRUST;
}

/** Trust prior for a source URL (extracts the domain first). */
export function trustScoreForUrl(
  url: string,
  overrides?: ReadonlyMap<string, number>,
): number {
  const domain = extractDomain(url);
  return domain ? trustScoreForDomain(domain, overrides) : DEFAULT_SOURCE_TRUST;
}

// ─────────────────────────────────────────────────────────────────────────────
// BAYESIAN CONFIDENCE AGGREGATION  (C21 / T4)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Aggregate confidence across DISTINCT corroborating sources:
 *
 *     confidence = 1 − Π (1 − r_i)
 *
 * Each independent source can only reduce the remaining doubt, so confidence
 * rises with corroboration and saturates near 1 — but a second mention from
 * the SAME source must not be passed in twice (C21: the caller deduplicates
 * by provenance cluster before calling this).
 *
 * - no sources        → 0   (no evidence)
 * - one source r      → r
 * - a 0-trust source contributes nothing (1 − 0 = 1 factor)
 */
export function bayesianConfidence(distinctSourceTrust: ReadonlyArray<number>): number {
  if (distinctSourceTrust.length === 0) return 0;
  let doubt = 1;
  for (const r of distinctSourceTrust) {
    doubt *= 1 - clamp01(r);
  }
  return clamp01(1 - doubt);
}

// ─────────────────────────────────────────────────────────────────────────────
// QUARANTINE DECISION  (C24)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Should a claim be quarantined — stored but withheld from Portfolio/Global
 * retrieval until it earns its place?
 *
 * Quarantine when the source is below the trust threshold AND the claim is
 * not yet corroborated by enough distinct sources. A trusted source, or
 * sufficient corroboration, clears it.
 *
 * @param trustScore                  trust prior of the claim's source
 * @param distinctCorroboratingSources count of DISTINCT sources asserting it
 */
export function shouldQuarantine(
  trustScore: number,
  distinctCorroboratingSources: number,
): boolean {
  if (trustScore >= QUARANTINE_TRUST_THRESHOLD) return false;
  return distinctCorroboratingSources < QUARANTINE_MIN_CORROBORATION;
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL
// ─────────────────────────────────────────────────────────────────────────────

/** Clamp a number into [0, 1]; non-finite input becomes 0. */
function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}
