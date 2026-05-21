/**
 * Pattern Distillation — IMPLEMENTATION_PLAN.md Phase 7, Workstream 7.2
 * Cross-portco pattern publication (P12)
 *
 * Before a pattern learned inside one portfolio company can be surfaced to
 * another, two things must hold:
 *
 *   1. It must be drawn from ENOUGH companies — at least three — so no single
 *      portco's situation can be reverse-engineered from the pattern.
 *   2. It must be ANONYMIZED — company names, specific dollar amounts, and
 *      specific dates stripped, so the pattern carries no identifying detail.
 *
 * Both checks are PURE, deterministic functions — the anonymization is never
 * left to a model's discretion.
 */

// ─────────────────────────────────────────────────────────────────────────────
// PUBLICATION GATE
// ─────────────────────────────────────────────────────────────────────────────

/** A pattern must be drawn from at least this many portcos before it can cross
 * a company boundary (P12 — prevents single-portco re-identification). */
export const MIN_PORTCOS_FOR_PUBLICATION = 3;

/** Is the pattern drawn from enough portcos to publish? Pure. */
export function canPublishPattern(sourcePortcoCount: number): boolean {
  return (
    Number.isFinite(sourcePortcoCount) &&
    sourcePortcoCount >= MIN_PORTCOS_FOR_PUBLICATION
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ANONYMIZATION
// ─────────────────────────────────────────────────────────────────────────────

export interface AnonymizationResult {
  text: string;
  /** How many identifying details were stripped. */
  redactionCount: number;
}

const COMPANY_PLACEHOLDER = "a portfolio company";
const AMOUNT_PLACEHOLDER = "[amount]";
const DATE_PLACEHOLDER = "[date]";

const MONTHS =
  "(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)";

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Strip identifying detail from a pattern's text: company names, currency
 * amounts, and specific dates. Returns the anonymized text and the number of
 * redactions made. Pure — exported for tests.
 */
export function anonymizeText(text: string, companyNames: string[]): AnonymizationResult {
  let out = text;
  let redactionCount = 0;

  const countAndReplace = (pattern: RegExp, replacement: string) => {
    out = out.replace(pattern, () => {
      redactionCount += 1;
      return replacement;
    });
  };

  // Company names — longest first so "Acme Health Co" is matched before "Acme".
  const names = companyNames
    .map((n) => n.trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  for (const name of names) {
    countAndReplace(new RegExp(`\\b${escapeRegExp(name)}\\b`, "gi"), COMPANY_PLACEHOLDER);
  }

  // Currency amounts — $1.2M, $450,000, €30k, etc.
  countAndReplace(/[$€£]\s?\d[\d,]*(?:\.\d+)?\s?(?:[KMB]|thousand|million|billion)?\b/gi, AMOUNT_PLACEHOLDER);

  // Explicit dates — "March 2024", "Mar 3, 2024", ISO "2024-03-01".
  countAndReplace(new RegExp(`\\b${MONTHS}\\.?\\s+\\d{1,2},?\\s+\\d{4}\\b`, "gi"), DATE_PLACEHOLDER);
  countAndReplace(new RegExp(`\\b${MONTHS}\\.?\\s+\\d{4}\\b`, "gi"), DATE_PLACEHOLDER);
  countAndReplace(/\b\d{4}-\d{2}-\d{2}\b/g, DATE_PLACEHOLDER);

  return { text: out, redactionCount };
}

// ─────────────────────────────────────────────────────────────────────────────
// DISTILLATION
// ─────────────────────────────────────────────────────────────────────────────

export interface DistilledPattern {
  /** Can this pattern be surfaced across the company boundary? */
  publishable: boolean;
  reason: string;
  anonymizedText: string;
  redactionCount: number;
}

/**
 * Distill a pattern for cross-company publication: enforce the min-portco gate
 * and anonymize the text. Pure — exported for tests.
 */
export function distillPattern(params: {
  patternText: string;
  companyNames: string[];
  sourcePortcoCount: number;
}): DistilledPattern {
  const { text, redactionCount } = anonymizeText(params.patternText, params.companyNames);
  const publishable = canPublishPattern(params.sourcePortcoCount);

  return {
    publishable,
    reason: publishable
      ? `Drawn from ${params.sourcePortcoCount} portcos — clears the min-${MIN_PORTCOS_FOR_PUBLICATION} publication gate.`
      : `Drawn from only ${params.sourcePortcoCount} portco(s) — needs at least ${MIN_PORTCOS_FOR_PUBLICATION} before it can be published.`,
    anonymizedText: text,
    redactionCount,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// AGGREGATE STATISTICS
// ─────────────────────────────────────────────────────────────────────────────

export interface AggregateStat {
  label: string;
  n: number;
  median: number;
  mean: number;
  min: number;
  max: number;
}

/**
 * Aggregate a set of per-portco numeric outcomes into a publishable statistic,
 * e.g. "SaaS portcos N=4 hit payback at median 14mo". Returns null when there
 * are too few data points to publish (min N). Pure — exported for tests.
 */
export function aggregateStat(label: string, values: number[]): AggregateStat | null {
  const clean = values.filter((v) => Number.isFinite(v));
  if (clean.length < MIN_PORTCOS_FOR_PUBLICATION) return null;

  const sorted = [...clean].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  const mean = clean.reduce((s, v) => s + v, 0) / clean.length;

  const round2 = (n: number) => Math.round(n * 100) / 100;
  return {
    label,
    n: clean.length,
    median: round2(median),
    mean: round2(mean),
    min: sorted[0],
    max: sorted[sorted.length - 1],
  };
}
