/**
 * Anti-Hallucination Audit — IMPLEMENTATION_PLAN.md Phase 6, Workstream 6.5
 * Constitution-based audit (T9, N3)
 *
 * The audit measures principle-COMPLIANCE, not vibes. A small constitution of
 * explicit, checkable principles is applied to ledger claims:
 *
 *   - every numeric claim cites a source
 *   - every prediction specifies a horizon and a confidence
 *   - every causal claim names plausible confounders
 *   - every cross-portfolio analogy names both sides
 *
 * Each check is a PURE, deterministic heuristic — exported and unit-tested.
 * The nightly priority-sampled cron (N2) that runs this over a memory sample
 * depends on the audit scheduler — this module is the checker it calls.
 */

// ─────────────────────────────────────────────────────────────────────────────
// CONSTITUTION
// ─────────────────────────────────────────────────────────────────────────────

export interface ConstitutionalPrinciple {
  id: string;
  label: string;
  description: string;
}

export const CONSTITUTIONAL_PRINCIPLES: readonly ConstitutionalPrinciple[] = [
  {
    id: "numeric-cites-source",
    label: "Numeric claims cite a source",
    description: "Every numeric claim cites a source.",
  },
  {
    id: "prediction-has-horizon-confidence",
    label: "Predictions specify horizon + confidence",
    description: "Every prediction specifies a time horizon and a confidence.",
  },
  {
    id: "causal-names-confounders",
    label: "Causal claims name confounders",
    description: "Every causal claim names plausible confounders.",
  },
  {
    id: "analogy-names-both-sides",
    label: "Cross-portfolio analogies name both sides",
    description: "Every cross-portfolio analogy names both companies.",
  },
] as const;

export type CheckResult = "compliant" | "violation" | "not-applicable";

// ─────────────────────────────────────────────────────────────────────────────
// PURE DETECTORS
// ─────────────────────────────────────────────────────────────────────────────

/** Does the text make a numeric claim? Excludes bare 4-digit years. Pure. */
export function hasNumericClaim(text: string): boolean {
  const withoutYears = text.replace(/\b(19|20)\d{2}\b/g, "");
  return /\d/.test(withoutYears);
}

/** Does the text cite a source? Pure. */
export function citesSource(text: string): boolean {
  return /\b(source|per |according to|cited|cites|\[\d|https?:\/\/|ref:|memory)\b/i.test(text);
}

/** Does the text make a causal claim? Pure. */
export function hasCausalLanguage(text: string): boolean {
  return /\b(because|caused|causes|led to|leads to|drove|drives|driven by|due to|resulted in|results in|thanks to|owing to)\b/i.test(
    text,
  );
}

/** Does the text name a confounder or condition its causal claim? Pure. */
export function namesConfounder(text: string): boolean {
  return /\b(confound|controlling for|all else equal|all else being equal|absent|even without|aside from|net of|adjust(ed|ing) for|holding .* constant)\b/i.test(
    text,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PREDICTION-ENTRY CHECKS
// ─────────────────────────────────────────────────────────────────────────────

export interface AuditablePrediction {
  claim: string;
  confidence?: number | null;
  horizon?: string | null;
}

/**
 * Check one prediction-ledger entry against one constitutional principle.
 * Returns "not-applicable" when the principle does not bear on this entry.
 * Pure — exported for tests.
 */
export function checkPrediction(
  principleId: string,
  entry: AuditablePrediction,
): CheckResult {
  const claim = (entry.claim ?? "").trim();

  switch (principleId) {
    case "numeric-cites-source":
      if (!claim || !hasNumericClaim(claim)) return "not-applicable";
      return citesSource(claim) ? "compliant" : "violation";

    case "prediction-has-horizon-confidence": {
      const hasConfidence =
        typeof entry.confidence === "number" && Number.isFinite(entry.confidence);
      const hasHorizon = typeof entry.horizon === "string" && entry.horizon.trim().length > 0;
      return hasConfidence && hasHorizon ? "compliant" : "violation";
    }

    case "causal-names-confounders":
      if (!claim || !hasCausalLanguage(claim)) return "not-applicable";
      return namesConfounder(claim) ? "compliant" : "violation";

    // Cross-portfolio analogy detection is not reliable on a single ledger
    // claim — left out of the prediction-level audit.
    case "analogy-names-both-sides":
      return "not-applicable";

    default:
      return "not-applicable";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// REPORT
// ─────────────────────────────────────────────────────────────────────────────

export interface PrincipleCompliance {
  principleId: string;
  label: string;
  /** How many entries the principle applied to. */
  applicable: number;
  violations: number;
  /** (applicable − violations) / applicable, or 1 when nothing applied. */
  complianceRate: number;
}

export interface FlaggedEntry {
  claim: string;
  violatedPrinciples: string[];
}

export interface ComplianceReport {
  sampleSize: number;
  /** Overall compliance across all applicable checks. */
  overallComplianceRate: number;
  principles: PrincipleCompliance[];
  flagged: FlaggedEntry[];
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

/**
 * Audit a sample of prediction-ledger entries against the constitution. Pure —
 * exported for tests.
 */
export function auditPredictions(entries: AuditablePrediction[]): ComplianceReport {
  const principles: PrincipleCompliance[] = CONSTITUTIONAL_PRINCIPLES.map((p) => ({
    principleId: p.id,
    label: p.label,
    applicable: 0,
    violations: 0,
    complianceRate: 1,
  }));
  const byId = new Map(principles.map((p) => [p.principleId, p]));
  const flagged: FlaggedEntry[] = [];

  for (const entry of entries) {
    const violated: string[] = [];
    for (const principle of CONSTITUTIONAL_PRINCIPLES) {
      const result = checkPrediction(principle.id, entry);
      if (result === "not-applicable") continue;
      const stat = byId.get(principle.id)!;
      stat.applicable += 1;
      if (result === "violation") {
        stat.violations += 1;
        violated.push(principle.id);
      }
    }
    if (violated.length > 0) {
      flagged.push({ claim: entry.claim, violatedPrinciples: violated });
    }
  }

  let totalApplicable = 0;
  let totalViolations = 0;
  for (const stat of principles) {
    stat.complianceRate =
      stat.applicable === 0 ? 1 : round4((stat.applicable - stat.violations) / stat.applicable);
    totalApplicable += stat.applicable;
    totalViolations += stat.violations;
  }

  return {
    sampleSize: entries.length,
    overallComplianceRate:
      totalApplicable === 0 ? 1 : round4((totalApplicable - totalViolations) / totalApplicable),
    principles,
    flagged,
  };
}
