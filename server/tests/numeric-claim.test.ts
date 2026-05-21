/**
 * Unit tests — Structured Numeric Claims (server/extraction/numeric-claim.ts)
 * IMPLEMENTATION_PLAN.md Workstream 1.4 · MEMORY_AND_LEARNING_REVIEW.md A5
 */

import { describe, it, expect } from "vitest";
import {
  parseMagnitude,
  canonicalUnit,
  isCurrencyUnit,
  canonicalValue,
  normalizeNumericClaim,
  annualize,
  numericClaimsEquivalent,
  classifyNumericPair,
  type NumericClaim,
} from "../extraction/numeric-claim";

describe("numeric-claim — parseMagnitude", () => {
  it("parses short and long magnitude forms, case-insensitively", () => {
    expect(parseMagnitude("M")).toBe("M");
    expect(parseMagnitude("m")).toBe("M");
    expect(parseMagnitude("million")).toBe("M");
    expect(parseMagnitude("bn")).toBe("B");
    expect(parseMagnitude("Billion")).toBe("B");
    expect(parseMagnitude("k")).toBe("K");
    expect(parseMagnitude("thousand")).toBe("K");
    expect(parseMagnitude("trillion")).toBe("T");
  });

  it("returns undefined for non-magnitude text", () => {
    expect(parseMagnitude("")).toBeUndefined();
    expect(parseMagnitude("xyz")).toBeUndefined();
    expect(parseMagnitude("percent")).toBeUndefined();
  });
});

describe("numeric-claim — canonicalUnit", () => {
  it("collapses currency spellings to ISO codes", () => {
    expect(canonicalUnit("$")).toBe("USD");
    expect(canonicalUnit("US$")).toBe("USD");
    expect(canonicalUnit("dollars")).toBe("USD");
    expect(canonicalUnit("€")).toBe("EUR");
    expect(canonicalUnit("₹")).toBe("INR");
    expect(canonicalUnit("Rupees")).toBe("INR");
  });

  it("collapses percent spellings to %", () => {
    expect(canonicalUnit("percent")).toBe("%");
    expect(canonicalUnit("pct")).toBe("%");
    expect(canonicalUnit("%")).toBe("%");
  });

  it("lower-cases and trims other units so they dedup", () => {
    expect(canonicalUnit("  Customers ")).toBe("customers");
    expect(canonicalUnit("Months")).toBe("months");
  });

  it("isCurrencyUnit recognises currencies only", () => {
    expect(isCurrencyUnit("$")).toBe(true);
    expect(isCurrencyUnit("USD")).toBe(true);
    expect(isCurrencyUnit("customers")).toBe(false);
    expect(isCurrencyUnit("%")).toBe(false);
  });
});

describe("numeric-claim — canonicalValue & normalize", () => {
  it("expands magnitude into the value", () => {
    expect(canonicalValue({ value: 24.3, unit: "USD", magnitude: "M" })).toBe(24_300_000);
    expect(canonicalValue({ value: 1.2, unit: "USD", magnitude: "B" })).toBe(1_200_000_000);
    expect(canonicalValue({ value: 500, unit: "customers" })).toBe(500);
  });

  it("normalizeNumericClaim expands magnitude, canonicalises unit, defaults period", () => {
    const n = normalizeNumericClaim({ value: 24, unit: "$", magnitude: "M" });
    expect(n.value).toBe(24_000_000);
    expect(n.unit).toBe("USD");
    expect(n.magnitude).toBeUndefined();
    expect(n.period).toBe("one_time");
  });

  it("preserves basis when present", () => {
    const n = normalizeNumericClaim({ value: 24, unit: "USD", magnitude: "M", basis: "ARR" });
    expect(n.basis).toBe("ARR");
  });
});

describe("numeric-claim — annualize", () => {
  it("scales a monthly flow to annual", () => {
    const a = annualize({ value: 2, unit: "USD", magnitude: "M", period: "monthly" });
    expect(a).not.toBeNull();
    expect(a!.value).toBe(24_000_000);
    expect(a!.period).toBe("annual");
  });

  it("scales a quarterly flow to annual", () => {
    const a = annualize({ value: 6, unit: "USD", magnitude: "M", period: "quarterly" });
    expect(a!.value).toBe(24_000_000);
  });

  it("leaves an annual flow unchanged in value", () => {
    const a = annualize({ value: 24, unit: "USD", magnitude: "M", period: "annual" });
    expect(a!.value).toBe(24_000_000);
  });

  it("returns null for a one_time stock (cannot annualise)", () => {
    expect(annualize({ value: 500, unit: "customers", period: "one_time" })).toBeNull();
    expect(annualize({ value: 500, unit: "customers" })).toBeNull(); // period defaults to one_time
  });

  it("returns null for a ratio (% is not additive across periods)", () => {
    expect(annualize({ value: 5, unit: "%", period: "monthly" })).toBeNull();
  });
});

describe("numeric-claim — numericClaimsEquivalent (the dedup primitive, A5)", () => {
  it("'$24M' equals '24 million USD' (magnitude + unit normalisation)", () => {
    const a: NumericClaim = { value: 24, unit: "$", magnitude: "M" };
    const b: NumericClaim = { value: 24_000_000, unit: "USD" };
    expect(numericClaimsEquivalent(a, b)).toBe(true);
  });

  it("'$2M/month' equals '$24M/year' (period annualisation)", () => {
    const a: NumericClaim = { value: 2, unit: "USD", magnitude: "M", period: "monthly" };
    const b: NumericClaim = { value: 24, unit: "USD", magnitude: "M", period: "annual" };
    expect(numericClaimsEquivalent(a, b)).toBe(true);
  });

  it("respects the tolerance band", () => {
    const a: NumericClaim = { value: 100, unit: "customers" };
    const b: NumericClaim = { value: 100.5, unit: "customers" };
    expect(numericClaimsEquivalent(a, b, { tolerance: 0.01 })).toBe(true); // 0.5% < 1%
    expect(numericClaimsEquivalent(a, b, { tolerance: 0.001 })).toBe(false); // 0.5% > 0.1%
  });

  it("different currencies are never equivalent (no FX)", () => {
    const a: NumericClaim = { value: 24, unit: "USD", magnitude: "M" };
    const b: NumericClaim = { value: 24, unit: "EUR", magnitude: "M" };
    expect(numericClaimsEquivalent(a, b)).toBe(false);
  });

  it("a stock and a flow are never equivalent", () => {
    const stock: NumericClaim = { value: 500, unit: "customers", period: "one_time" };
    const flow: NumericClaim = { value: 500, unit: "customers", period: "monthly" };
    expect(numericClaimsEquivalent(stock, flow)).toBe(false);
  });

  it("can be told not to annualise flows", () => {
    const a: NumericClaim = { value: 2, unit: "USD", magnitude: "M", period: "monthly" };
    const b: NumericClaim = { value: 24, unit: "USD", magnitude: "M", period: "annual" };
    expect(numericClaimsEquivalent(a, b, { annualizeFlows: false })).toBe(false);
  });
});

describe("numeric-claim — classifyNumericPair (ADD/UPDATE/SUPERSEDE/NOOP input, C23)", () => {
  it("identical facts → duplicate", () => {
    const a: NumericClaim = { value: 24, unit: "$", magnitude: "M", basis: "ARR" };
    const b: NumericClaim = { value: 24_000_000, unit: "USD", basis: "ARR" };
    expect(classifyNumericPair(a, b)).toBe("duplicate");
  });

  it("same unit & period, disagreeing values → contradiction", () => {
    const a: NumericClaim = { value: 24, unit: "USD", magnitude: "M" };
    const b: NumericClaim = { value: 30, unit: "USD", magnitude: "M" };
    expect(classifyNumericPair(a, b)).toBe("contradiction");
  });

  it("two flows with different periods that disagree → contradiction", () => {
    const a: NumericClaim = { value: 3, unit: "USD", magnitude: "M", period: "monthly" }; // 36M/yr
    const b: NumericClaim = { value: 24, unit: "USD", magnitude: "M", period: "annual" }; // 24M/yr
    expect(classifyNumericPair(a, b)).toBe("contradiction");
  });

  it("different units → unrelated", () => {
    const a: NumericClaim = { value: 24, unit: "USD", magnitude: "M" };
    const b: NumericClaim = { value: 24, unit: "customers" };
    expect(classifyNumericPair(a, b)).toBe("unrelated");
  });

  it("stock vs flow → unrelated", () => {
    const a: NumericClaim = { value: 500, unit: "customers", period: "one_time" };
    const b: NumericClaim = { value: 40, unit: "customers", period: "monthly" };
    expect(classifyNumericPair(a, b)).toBe("unrelated");
  });
});
