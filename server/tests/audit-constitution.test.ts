/**
 * Unit tests — Anti-Hallucination Audit (server/services/audit-constitution.ts)
 * IMPLEMENTATION_PLAN.md Phase 6 / Workstream 6.5
 */

import { describe, it, expect } from "vitest";
import {
  CONSTITUTIONAL_PRINCIPLES,
  hasNumericClaim,
  citesSource,
  hasCausalLanguage,
  namesConfounder,
  checkPrediction,
  auditPredictions,
} from "../services/audit-constitution";

describe("audit-constitution — detectors", () => {
  it("hasNumericClaim spots numbers but ignores bare years", () => {
    expect(hasNumericClaim("ARR grew 32% last quarter")).toBe(true);
    expect(hasNumericClaim("The plan launched in 2024")).toBe(false);
    expect(hasNumericClaim("Strong momentum across the board")).toBe(false);
  });

  it("citesSource spots a citation", () => {
    expect(citesSource("Revenue is up, per the Q2 board deck")).toBe(true);
    expect(citesSource("Revenue is up sharply")).toBe(false);
  });

  it("hasCausalLanguage and namesConfounder", () => {
    expect(hasCausalLanguage("Churn fell because we shipped onboarding")).toBe(true);
    expect(hasCausalLanguage("Churn fell this quarter")).toBe(false);
    expect(namesConfounder("Churn fell, though controlling for the seasonal dip")).toBe(true);
    expect(namesConfounder("Churn fell because we shipped onboarding")).toBe(false);
  });
});

describe("audit-constitution — checkPrediction", () => {
  it("flags a numeric claim with no source", () => {
    expect(
      checkPrediction("numeric-cites-source", { claim: "NRR will reach 130%" }),
    ).toBe("violation");
    expect(
      checkPrediction("numeric-cites-source", {
        claim: "NRR will reach 130%, per the cohort analysis",
      }),
    ).toBe("compliant");
  });

  it("is not-applicable when a claim has no numeric content", () => {
    expect(
      checkPrediction("numeric-cites-source", { claim: "The moat will widen" }),
    ).toBe("not-applicable");
  });

  it("flags a prediction missing horizon or confidence", () => {
    expect(
      checkPrediction("prediction-has-horizon-confidence", { claim: "x", confidence: 0.7 }),
    ).toBe("violation");
    expect(
      checkPrediction("prediction-has-horizon-confidence", {
        claim: "x",
        confidence: 0.7,
        horizon: "12 months",
      }),
    ).toBe("compliant");
  });

  it("flags a causal claim with no confounder named", () => {
    expect(
      checkPrediction("causal-names-confounders", {
        claim: "Sales rose because of the new pricing",
      }),
    ).toBe("violation");
    expect(
      checkPrediction("causal-names-confounders", {
        claim: "Sales rose because of the new pricing, even without the seasonal lift",
      }),
    ).toBe("compliant");
  });
});

describe("audit-constitution — auditPredictions", () => {
  it("aggregates a compliance report across a sample", () => {
    const report = auditPredictions([
      { claim: "NRR will reach 130%", confidence: 0.7, horizon: "12 months" },
      { claim: "The moat widens over time", confidence: 0.6, horizon: "long" },
      { claim: "Churn fell because of onboarding", confidence: 0.8 },
    ]);
    expect(report.sampleSize).toBe(3);
    const horizonStat = report.principles.find(
      (p) => p.principleId === "prediction-has-horizon-confidence",
    )!;
    expect(horizonStat.applicable).toBe(3);
    expect(horizonStat.violations).toBe(1);
    expect(report.flagged.length).toBeGreaterThan(0);
  });

  it("reports full compliance for a clean sample", () => {
    const report = auditPredictions([
      { claim: "The brand strengthens", confidence: 0.6, horizon: "2 years" },
    ]);
    expect(report.overallComplianceRate).toBe(1);
    expect(report.flagged).toEqual([]);
  });

  it("handles an empty sample", () => {
    const report = auditPredictions([]);
    expect(report.sampleSize).toBe(0);
    expect(report.overallComplianceRate).toBe(1);
  });

  it("exposes the four constitutional principles", () => {
    expect(CONSTITUTIONAL_PRINCIPLES).toHaveLength(4);
    const report = auditPredictions([]);
    expect(report.principles).toHaveLength(4);
  });
});
