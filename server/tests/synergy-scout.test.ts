/**
 * Unit tests — Synergy Scout (server/agents/synergy-scout.ts)
 * IMPLEMENTATION_PLAN.md Phase 7 / Workstream 7.1
 */

import { describe, it, expect } from "vitest";
import {
  SYNERGY_DETECTORS,
  normalizeSynergyResult,
  type SynergyCompany,
} from "../agents/synergy-scout";

const companies: SynergyCompany[] = [
  { id: 1, name: "Acme Logistics" },
  { id: 2, name: "Beacon Health" },
  { id: 3, name: "Cobalt Foods" },
];

describe("synergy-scout — detectors", () => {
  it("has the 9 distinct detectors", () => {
    expect(SYNERGY_DETECTORS).toHaveLength(9);
    expect(new Set(SYNERGY_DETECTORS.map((d) => d.id)).size).toBe(9);
  });
});

describe("synergy-scout — normalizeSynergyResult", () => {
  it("normalizes candidates and resolves company names to ids", () => {
    const r = normalizeSynergyResult(
      {
        candidates: [
          {
            detector: "customer_overlap",
            companies: ["Acme Logistics", "Beacon Health"],
            description: "Both sell into regional hospital networks.",
            value: "high",
            confidence: 0.8,
            recommendedAction: "Run a joint account-mapping session.",
          },
        ],
      },
      companies,
    );
    expect(r.candidates).toHaveLength(1);
    expect(r.candidates[0].detector).toBe("customer_overlap");
    expect(r.candidates[0].detectorLabel).toBe("Customer overlap");
    expect(r.candidates[0].companyIds).toEqual([1, 2]);
  });

  it("drops candidates with an unknown detector or no description", () => {
    const r = normalizeSynergyResult(
      {
        candidates: [
          { detector: "telepathy_overlap", description: "x", value: "high" },
          { detector: "talent_overlap", value: "high" },
          { detector: "talent_overlap", description: "Shared eng hiring pool", value: "medium" },
        ],
      },
      companies,
    );
    expect(r.candidates).toHaveLength(1);
    expect(r.candidates[0].detector).toBe("talent_overlap");
  });

  it("sorts candidates by value then confidence", () => {
    const r = normalizeSynergyResult(
      {
        candidates: [
          { detector: "macro_exposure", description: "low one", value: "low", confidence: 0.9 },
          { detector: "capability_overlap", description: "high one", value: "high", confidence: 0.5 },
          { detector: "channel_overlap", description: "medium one", value: "medium", confidence: 0.6 },
        ],
      },
      companies,
    );
    expect(r.candidates.map((c) => c.value)).toEqual(["high", "medium", "low"]);
  });

  it("defaults an unknown value to medium and clamps confidence", () => {
    const r = normalizeSynergyResult(
      {
        candidates: [
          { detector: "supplier_overlap", description: "x", value: "enormous", confidence: 5 },
        ],
      },
      companies,
    );
    expect(r.candidates[0].value).toBe("medium");
    expect(r.candidates[0].confidence).toBe(1);
  });

  it("handles a non-object payload", () => {
    expect(normalizeSynergyResult(null, companies).candidates).toEqual([]);
  });
});
