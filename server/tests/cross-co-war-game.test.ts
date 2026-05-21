/**
 * Unit tests — Cross-Company War-Game (server/agents/cross-co-war-game.ts)
 * IMPLEMENTATION_PLAN.md Phase 3 / Workstream 3.6
 */

import { describe, it, expect } from "vitest";
import {
  normalizeCrossCoResult,
  type CrossCoCompany,
} from "../agents/cross-co-war-game";

const companies: CrossCoCompany[] = [
  { id: 1, name: "Acme Logistics" },
  { id: 2, name: "Beacon Health" },
  { id: 3, name: "Cobalt Foods" },
];

describe("cross-co-war-game — normalizeCrossCoResult", () => {
  it("resolves company names to ids and keeps the scenario", () => {
    const r = normalizeCrossCoResult(
      {
        companyOutcomes: [
          { company: "Acme Logistics", outcome: "Freight costs spike.", exposure: "high" },
          { company: "Beacon Health", outcome: "Largely insulated.", exposure: "low" },
        ],
        findings: [
          {
            kind: "risk",
            finding: "Both depend on the same fuel hedge counterparty.",
            companies: ["Acme Logistics", "Beacon Health"],
          },
        ],
        portfolioImplication: "Diversify the hedge counterparty.",
      },
      "Oil price doubles overnight.",
      companies,
    );
    expect(r.scenario).toBe("Oil price doubles overnight.");
    expect(r.companyOutcomes).toHaveLength(2);
    expect(r.companyOutcomes[0].companyId).toBe(1);
    expect(r.companyOutcomes[0].exposure).toBe("high");
    expect(r.findings[0].companyIds).toEqual([1, 2]);
    expect(r.portfolioImplication).toBe("Diversify the hedge counterparty.");
  });

  it("matches a partial / case-insensitive company name", () => {
    const r = normalizeCrossCoResult(
      { companyOutcomes: [{ company: "acme", outcome: "Hit hard.", exposure: "high" }] },
      "S",
      companies,
    );
    expect(r.companyOutcomes[0].companyId).toBe(1);
  });

  it("defaults an unknown exposure to medium", () => {
    const r = normalizeCrossCoResult(
      { companyOutcomes: [{ company: "Cobalt Foods", outcome: "x", exposure: "catastrophic" }] },
      "S",
      companies,
    );
    expect(r.companyOutcomes[0].exposure).toBe("medium");
  });

  it("defaults an unknown finding kind to risk", () => {
    const r = normalizeCrossCoResult(
      {
        companyOutcomes: [],
        findings: [{ kind: "opportunity", finding: "Something." }],
      },
      "S",
      companies,
    );
    expect(r.findings[0].kind).toBe("risk");
  });

  it("drops outcomes with no text, unknown companies, and duplicate companies", () => {
    const r = normalizeCrossCoResult(
      {
        companyOutcomes: [
          { company: "Acme Logistics", outcome: "First.", exposure: "low" },
          { company: "Acme Logistics", outcome: "Duplicate — dropped.", exposure: "high" },
          { company: "Ghost Corp", outcome: "Unknown — dropped.", exposure: "low" },
          { company: "Beacon Health", exposure: "low" },
        ],
        portfolioImplication: "p",
      },
      "S",
      companies,
    );
    expect(r.companyOutcomes).toHaveLength(1);
    expect(r.companyOutcomes[0].outcome).toBe("First.");
  });

  it("supplies a fallback for a non-object payload", () => {
    const r = normalizeCrossCoResult(null, "S", companies);
    expect(r.companyOutcomes).toEqual([]);
    expect(r.findings).toEqual([]);
    expect(r.portfolioImplication).toBe(
      "The cross-company war-game produced no clear portfolio implication.",
    );
  });

  it("caps findings at 12", () => {
    const r = normalizeCrossCoResult(
      {
        companyOutcomes: [],
        findings: [...Array(20).keys()].map((i) => ({ kind: "risk", finding: `Finding ${i}` })),
        portfolioImplication: "p",
      },
      "S",
      companies,
    );
    expect(r.findings).toHaveLength(12);
  });
});
