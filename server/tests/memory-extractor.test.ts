/**
 * Unit tests — Memory-Claim Extractor output normalisation
 * server/services/memory-extractor.ts
 *
 * Covers normalizeExtractionOutput — the defensive parser that turns raw LLM
 * output into clean claims. The LLM call itself runs in the integration suite.
 */

import { describe, it, expect } from "vitest";
import { normalizeExtractionOutput } from "../services/memory-extractor";

describe("memory-extractor — normalizeExtractionOutput", () => {
  it("normalizes a well-formed claim", () => {
    const out = normalizeExtractionOutput({
      claims: [
        {
          rawContent: "Acme grew ARR to $24M in 2026.",
          canonicalForm: "Acme | has ARR | $24M | in 2026",
          claimModality: "actual",
          market: "b2b_saas",
          geo: "US",
          numeric: { value: 24, unit: "USD", magnitude: "M", basis: "ARR" },
        },
      ],
    });
    expect(out).toHaveLength(1);
    expect(out[0].rawContent).toBe("Acme grew ARR to $24M in 2026.");
    expect(out[0].canonicalForm).toBe("Acme | has ARR | $24M | in 2026");
    expect(out[0].claimModality).toBe("actual");
    expect(out[0].dims.market).toBe("b2b_saas");
    expect(out[0].dims.geo).toBe("US");
    expect(out[0].numeric).toEqual({ value: 24, unit: "USD", magnitude: "M", basis: "ARR" });
  });

  it("returns [] for non-object or missing claims", () => {
    expect(normalizeExtractionOutput(null)).toEqual([]);
    expect(normalizeExtractionOutput("nope")).toEqual([]);
    expect(normalizeExtractionOutput({})).toEqual([]);
    expect(normalizeExtractionOutput({ claims: "not-an-array" })).toEqual([]);
  });

  it("skips a claim with no rawContent", () => {
    const out = normalizeExtractionOutput({
      claims: [{ canonicalForm: "x | y | z" }, { rawContent: "Real claim here." }],
    });
    expect(out).toHaveLength(1);
    expect(out[0].rawContent).toBe("Real claim here.");
  });

  it("defaults canonicalForm to rawContent when missing", () => {
    const out = normalizeExtractionOutput({
      claims: [{ rawContent: "Beta entered the EU market." }],
    });
    expect(out[0].canonicalForm).toBe("Beta entered the EU market.");
  });

  it("defaults an invalid modality to 'actual'", () => {
    const out = normalizeExtractionOutput({
      claims: [{ rawContent: "A claim.", claimModality: "wishful" }],
    });
    expect(out[0].claimModality).toBe("actual");
  });

  it("keeps a valid non-default modality", () => {
    const out = normalizeExtractionOutput({
      claims: [{ rawContent: "If Acme cut prices, Beta would follow.", claimModality: "hypothetical" }],
    });
    expect(out[0].claimModality).toBe("hypothetical");
  });

  it("drops an invalid numeric object", () => {
    const noValue = normalizeExtractionOutput({
      claims: [{ rawContent: "x", numeric: { unit: "USD" } }],
    });
    expect(noValue[0].numeric).toBeNull();

    const noUnit = normalizeExtractionOutput({
      claims: [{ rawContent: "x", numeric: { value: 10 } }],
    });
    expect(noUnit[0].numeric).toBeNull();
  });

  it("drops invalid magnitude/period but keeps the numeric core", () => {
    const out = normalizeExtractionOutput({
      claims: [
        {
          rawContent: "x",
          numeric: { value: 10, unit: "USD", magnitude: "ZILLION", period: "fortnightly" },
        },
      ],
    });
    expect(out[0].numeric).toEqual({ value: 10, unit: "USD" });
  });

  it("caps output at 25 claims per chunk", () => {
    const claims = Array.from({ length: 50 }, (_, i) => ({ rawContent: `Claim ${i}.` }));
    const out = normalizeExtractionOutput({ claims });
    expect(out).toHaveLength(25);
  });

  it("ignores non-object items in the claims array", () => {
    const out = normalizeExtractionOutput({
      claims: [null, "string", 42, { rawContent: "Only this one is real." }],
    });
    expect(out).toHaveLength(1);
    expect(out[0].rawContent).toBe("Only this one is real.");
  });
});
