/**
 * Structured Numeric Claims — IMPLEMENTATION_PLAN.md Workstream 1.4
 * MEMORY_AND_LEARNING_REVIEW.md edge case A5
 *
 * A numeric claim like "$24.3M ARR" or "grew 30% YoY" must be normalised
 * to a typed structure BEFORE dedup — otherwise "$24M" and "24 million USD"
 * look different, and "$2M/month" and "$24M/year" look like a contradiction
 * when they are the same fact.
 *
 * The LLM extractor produces the raw `NumericClaim` structure; this module
 * normalises and compares it. Pure logic — no DB, no LLM, no FX rates.
 * (Cross-currency conversion needs live FX data — deferred to Phase 2.)
 */

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

/** Order-of-magnitude suffix attached to a stated value. */
export const MAGNITUDES = ["K", "M", "B", "T"] as const;
export type Magnitude = (typeof MAGNITUDES)[number];

/** Temporal basis of a value. A "flow" recurs per period; "one_time" is a stock. */
export const PERIODS = [
  "one_time",
  "daily",
  "weekly",
  "monthly",
  "quarterly",
  "annual",
] as const;
export type Period = (typeof PERIODS)[number];

/** A numeric claim in structured form, as emitted by the extractor. */
export interface NumericClaim {
  /** The numeric value exactly as stated (before magnitude expansion). */
  value: number;
  /**
   * The unit. Currency claims use an ISO-4217-ish code ("USD", "EUR", "INR");
   * ratios use "%"; counts use a noun ("customers", "months", "headcount").
   */
  unit: string;
  /** Optional order-of-magnitude suffix (e.g. "M" in "$24M"). */
  magnitude?: Magnitude;
  /** Optional temporal basis. Absent ⇒ treated as one_time. */
  period?: Period;
  /** Free-text qualifier: "ARR", "YoY", "gross", "net of churn", … */
  basis?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const MAGNITUDE_FACTOR: Record<Magnitude, number> = {
  K: 1e3,
  M: 1e6,
  B: 1e9,
  T: 1e12,
};

/** How many of each period make up one year. `one_time` cannot be annualised. */
const PERIODS_PER_YEAR: Record<Exclude<Period, "one_time">, number> = {
  daily: 365,
  weekly: 52,
  monthly: 12,
  quarterly: 4,
  annual: 1,
};

/** Common currency spellings → canonical ISO-style code. */
const CURRENCY_ALIASES: Record<string, string> = {
  $: "USD",
  us$: "USD",
  usd: "USD",
  dollar: "USD",
  dollars: "USD",
  "€": "EUR",
  eur: "EUR",
  euro: "EUR",
  euros: "EUR",
  "£": "GBP",
  gbp: "GBP",
  pound: "GBP",
  pounds: "GBP",
  "₹": "INR",
  inr: "INR",
  rs: "INR",
  rupee: "INR",
  rupees: "INR",
  "¥": "JPY",
  jpy: "JPY",
  yen: "JPY",
};

// ─────────────────────────────────────────────────────────────────────────────
// PARSING HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse a magnitude suffix from free text.
 * Accepts "K", "M", "B", "T" and the long forms "thousand/million/billion/
 * trillion" and "bn"/"mn"/"k". Case-insensitive. Returns undefined if none.
 */
export function parseMagnitude(text: string): Magnitude | undefined {
  const t = text.trim().toLowerCase();
  switch (t) {
    case "k":
    case "thousand":
      return "K";
    case "m":
    case "mn":
    case "million":
      return "M";
    case "b":
    case "bn":
    case "billion":
      return "B";
    case "t":
    case "tn":
    case "trillion":
      return "T";
    default:
      return undefined;
  }
}

/**
 * Canonicalise a unit string. Currency spellings collapse to an ISO code;
 * "percent"/"pct" collapse to "%"; everything else is lower-cased and trimmed
 * (so "Customers" and "customers" dedup).
 */
export function canonicalUnit(unit: string): string {
  const u = unit.trim().toLowerCase();
  if (u in CURRENCY_ALIASES) return CURRENCY_ALIASES[u];
  if (u === "%" || u === "percent" || u === "pct" || u === "percentage") return "%";
  return u;
}

/** Is this unit a currency code we recognise? */
export function isCurrencyUnit(unit: string): boolean {
  const c = canonicalUnit(unit);
  return Object.values(CURRENCY_ALIASES).includes(c);
}

// ─────────────────────────────────────────────────────────────────────────────
// NORMALISATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The fully-expanded numeric value: stated value × magnitude factor.
 * "$24.3M" → 24_300_000.
 */
export function canonicalValue(claim: NumericClaim): number {
  const factor = claim.magnitude ? MAGNITUDE_FACTOR[claim.magnitude] : 1;
  return claim.value * factor;
}

/**
 * Return a normalised copy: magnitude expanded into the value, unit
 * canonicalised, magnitude cleared. Period and basis are preserved.
 */
export function normalizeNumericClaim(claim: NumericClaim): NumericClaim {
  const normalized: NumericClaim = {
    value: canonicalValue(claim),
    unit: canonicalUnit(claim.unit),
    period: claim.period ?? "one_time",
  };
  if (claim.basis !== undefined) normalized.basis = claim.basis;
  return normalized;
}

/**
 * Convert a flow claim to an annual basis (e.g. "$2M/month" → "$24M/year").
 *
 * Returns null when the claim cannot be annualised — a `one_time` stock has
 * no period, and a ratio ("%") is not additive across periods, so scaling it
 * would be meaningless.
 */
export function annualize(claim: NumericClaim): NumericClaim | null {
  const period = claim.period ?? "one_time";
  if (period === "one_time") return null;
  if (canonicalUnit(claim.unit) === "%") return null;

  const annualValue = canonicalValue(claim) * PERIODS_PER_YEAR[period];
  const result: NumericClaim = {
    value: annualValue,
    unit: canonicalUnit(claim.unit),
    period: "annual",
  };
  if (claim.basis !== undefined) result.basis = claim.basis;
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// EQUIVALENCE  (the dedup primitive — A5)
// ─────────────────────────────────────────────────────────────────────────────

export interface EquivalenceOptions {
  /**
   * Relative tolerance as a fraction (0.02 = 2%). Two values count as equal
   * if they are within this fraction of the larger one. Default 1%.
   */
  tolerance?: number;
  /**
   * When true, two flow claims with different periods are first annualised
   * before comparison ("$2M/month" ≡ "$24M/year"). Default true.
   */
  annualizeFlows?: boolean;
}

const DEFAULT_TOLERANCE = 0.01;

/** Are two numbers equal within a relative tolerance? */
function valuesClose(a: number, b: number, tolerance: number): boolean {
  if (a === b) return true;
  const larger = Math.max(Math.abs(a), Math.abs(b));
  if (larger === 0) return true; // both zero
  return Math.abs(a - b) / larger <= tolerance;
}

/**
 * Do two numeric claims assert the same fact?
 *
 * Used by the dedup / contradiction step (A5): two claims that normalise to
 * the same unit, period, and value (within tolerance) are duplicates, not
 * contradictions. Claims in different currencies are NOT equivalent here —
 * FX conversion needs live rates (Phase 2).
 */
export function numericClaimsEquivalent(
  a: NumericClaim,
  b: NumericClaim,
  options: EquivalenceOptions = {},
): boolean {
  const tolerance = options.tolerance ?? DEFAULT_TOLERANCE;
  const annualizeFlows = options.annualizeFlows ?? true;

  let na = normalizeNumericClaim(a);
  let nb = normalizeNumericClaim(b);

  // Different units are never equivalent (no FX, no cross-unit conversion).
  if (na.unit !== nb.unit) return false;

  const periodA = na.period ?? "one_time";
  const periodB = nb.period ?? "one_time";

  if (periodA !== periodB) {
    // A stock and a flow are different kinds of fact — never equivalent.
    if (periodA === "one_time" || periodB === "one_time") return false;
    // Two flows with different periods: annualise both, then compare.
    if (!annualizeFlows) return false;
    const aa = annualize(na);
    const ab = annualize(nb);
    if (!aa || !ab) return false;
    na = aa;
    nb = ab;
  }

  return valuesClose(na.value, nb.value, tolerance);
}

/**
 * Classify the relationship between two numeric claims for the extraction
 * pipeline's ADD/UPDATE/SUPERSEDE/NOOP decision (C23).
 *
 *  - "duplicate"      — same fact within tolerance ⇒ NOOP / reinforce
 *  - "contradiction"  — same unit & period but values disagree ⇒ contradiction edge
 *  - "unrelated"      — different unit or stock-vs-flow ⇒ independent ADD
 */
export function classifyNumericPair(
  a: NumericClaim,
  b: NumericClaim,
  options: EquivalenceOptions = {},
): "duplicate" | "contradiction" | "unrelated" {
  if (numericClaimsEquivalent(a, b, options)) return "duplicate";

  const na = normalizeNumericClaim(a);
  const nb = normalizeNumericClaim(b);
  if (na.unit !== nb.unit) return "unrelated";

  const periodA = na.period ?? "one_time";
  const periodB = nb.period ?? "one_time";
  // Same unit, comparable temporal basis, but not equivalent ⇒ they disagree.
  const comparable =
    periodA === periodB ||
    (periodA !== "one_time" && periodB !== "one_time"); // two flows
  return comparable ? "contradiction" : "unrelated";
}
