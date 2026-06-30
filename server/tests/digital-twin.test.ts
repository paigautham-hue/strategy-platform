/**
 * Unit tests — Digital Twin engine
 * service: server/services/digital-twin.ts · agent normalizers: server/agents/digital-twin-interview.ts
 * Salvaged from Dynamo (dimension-steered conversational intake).
 */

import { describe, it, expect } from "vitest";
import {
  scoreDimensionCoverage,
  overallCompleteness,
  underexploredDimensions,
  completenessGates,
  buildSteeringNote,
  PREVIEW_THRESHOLD,
  GENERATE_THRESHOLD,
  type DimensionCoverage,
} from "../services/digital-twin";
import { normalizeStrategy, renderTwinForPrompt } from "../agents/digital-twin-interview";

describe("digital-twin — graded coverage scoring", () => {
  it("scores a dimension by how many of its facets are mentioned (not binary)", () => {
    // Hits all four Business Model facets, nothing else.
    const full = scoreDimensionCoverage([
      { role: "user", content: "We sell to customers; our value proposition is strong and our competitive positioning is clear." },
    ]);
    expect(full.businessModel).toBe(100);
    expect(full.financials).toBe(0);
    expect(full.operations).toBe(0);
    expect(full.organization).toBe(0);
    expect(full.technology).toBe(0);
    expect(overallCompleteness(full)).toBe(20);
  });

  it("produces partial (graded) scores", () => {
    // Two of four Business Model facets (sell + customers).
    const partial = scoreDimensionCoverage([{ role: "user", content: "We sell to customers." }]);
    expect(partial.businessModel).toBe(50);
  });

  it("detects each dimension independently", () => {
    const tech = scoreDimensionCoverage([
      { role: "user", content: "Our tech stack runs in the cloud, with a data warehouse and ML analytics automation." },
    ]);
    expect(tech.technology).toBe(100);
  });

  it("scores only user-authored content (the consultant's own questions don't count)", () => {
    const cov = scoreDimensionCoverage([
      { role: "assistant", content: "Tell me about your revenue, customers, value proposition and competitive positioning." },
      { role: "user", content: "hi" },
    ]);
    expect(cov.businessModel).toBe(0);
  });

  it("does not credit businessModel for operations-only 'production' text (facets stay non-overlapping)", () => {
    const ops = scoreDimensionCoverage([
      { role: "user", content: "Our production line and supply chain throughput improved; quality defects fell." },
    ]);
    expect(ops.operations).toBeGreaterThanOrEqual(50);
    expect(ops.businessModel).toBe(0);
  });
});

describe("digital-twin — steering + funnel", () => {
  const bizOnly = scoreDimensionCoverage([
    { role: "user", content: "We sell to customers; our value proposition and competitive positioning are clear." },
  ]);

  it("orders under-explored dimensions least-covered first", () => {
    const under = underexploredDimensions(bizOnly);
    expect(under[0]).toBe("financials");
    expect(under).not.toContain("businessModel");
  });

  it("steers the system prompt toward the first under-explored dimension", () => {
    const note = buildSteeringNote(bizOnly);
    expect(note).toContain("Internal Note");
    expect(note).toContain("transition to ask about Financials");
  });

  it("gates preview and full-strategy monotonically", () => {
    const at = (v: number): DimensionCoverage => ({
      businessModel: v, financials: v, operations: v, organization: v, technology: v,
    });
    expect(completenessGates(at(20))).toMatchObject({ previewAvailable: false, fullStrategyAvailable: false });
    expect(completenessGates(at(PREVIEW_THRESHOLD))).toMatchObject({ previewAvailable: true, fullStrategyAvailable: false });
    expect(completenessGates(at(GENERATE_THRESHOLD))).toMatchObject({ previewAvailable: true, fullStrategyAvailable: true });
    expect(PREVIEW_THRESHOLD).toBeLessThan(GENERATE_THRESHOLD); // corrected from the donor's inverted gates
  });
});

describe("digital-twin — strategy normalizer", () => {
  it("clamps the readiness score and bounds the arrays", () => {
    const s = normalizeStrategy({
      aiReadinessScore: 150,
      executiveSummary: "  Strong fit.  ",
      opportunities: [{ title: "A", description: "B", impact: "high", feasibility: "low" }],
      useCases: [],
      risks: [{ risk: "R", mitigation: "M" }],
    });
    expect(s.aiReadinessScore).toBe(100);
    expect(s.executiveSummary).toBe("Strong fit.");
    expect(s.opportunities).toHaveLength(1);
    expect(s.risks[0]).toEqual({ risk: "R", mitigation: "M" });
  });

  it("degrades to a zeroed strategy on empty input", () => {
    const s = normalizeStrategy({});
    expect(s.aiReadinessScore).toBe(0);
    expect(s.executiveSummary).toBe("");
    expect(s.opportunities).toEqual([]);
    expect(s.useCases).toEqual([]);
    expect(s.risks).toEqual([]);
  });

  it("clamps a negative score to zero", () => {
    expect(normalizeStrategy({ aiReadinessScore: -5 }).aiReadinessScore).toBe(0);
  });
});

describe("digital-twin — prompt rendering", () => {
  it("renders the twin with captured + missing dimensions", () => {
    const out = renderTwinForPrompt({ businessModel: "sells widgets" }, "Acme");
    expect(out).toContain("Company: Acme");
    expect(out).toContain("Business Model: sells widgets");
    expect(out).toContain("Financials: (not yet captured)");
  });
});
