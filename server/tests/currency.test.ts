/**
 * Unit tests — Dual-Currency (server/services/currency.ts)
 * IMPLEMENTATION_PLAN.md Phase 5. Salvaged from StrategyForge, made pure.
 */

import { describe, it, expect } from "vitest";
import {
  CRORE,
  FALLBACK_USD_INR,
  convert,
  usdToInrCrores,
  inrCroresToUsd,
  formatInrCrores,
  formatUsdMillions,
  formatCurrency,
  dualCurrencyDisplay,
  parseCurrencyInput,
  percentageChange,
} from "../services/currency";

describe("currency — conversion", () => {
  it("converts USD to INR crores at an explicit rate", () => {
    // $1,000,000 × 80 = ₹80,000,000 = 8 Cr
    expect(usdToInrCrores(1_000_000, 80)).toBe(8);
  });

  it("round-trips USD → INR crores → USD", () => {
    const usd = 2_500_000;
    const cr = usdToInrCrores(usd, FALLBACK_USD_INR);
    expect(inrCroresToUsd(cr, FALLBACK_USD_INR)).toBeCloseTo(usd, 6);
  });

  it("defaults to the documented fallback rate", () => {
    expect(convert(1, FALLBACK_USD_INR)).toBe(83);
    expect(usdToInrCrores(CRORE / FALLBACK_USD_INR)).toBeCloseTo(1, 6);
  });
});

describe("currency — formatting", () => {
  it("formats crores and millions", () => {
    expect(formatInrCrores(99_600_000)).toBe("₹9.96 Cr");
    expect(formatUsdMillions(1_200_000)).toBe("$1.20M");
    expect(formatCurrency(50_000_000, "INR")).toBe("₹5.00 Cr");
    expect(formatCurrency(3_000_000, "USD")).toBe("$3.00M");
  });

  it("builds a dual display from a USD amount", () => {
    const d = dualCurrencyDisplay(1_000_000, 80);
    expect(d.usd).toBe("$1.00M");
    expect(d.inr).toBe("₹8.00 Cr");
    expect(d.usdRaw).toBe(1_000_000);
    expect(d.inrRaw).toBe(80_000_000);
    expect(d.rate).toBe(80);
  });
});

describe("currency — parsing + change", () => {
  it("parses crore and million suffixes", () => {
    expect(parseCurrencyInput("₹5.68 Cr", "INR")).toBe(56_800_000);
    expect(parseCurrencyInput("$2.5M", "USD")).toBe(2_500_000);
    expect(parseCurrencyInput("1234", "USD")).toBe(1234);
  });

  it("returns null on non-numeric input", () => {
    expect(parseCurrencyInput("abc", "USD")).toBeNull();
  });

  it("computes percentage change with direction", () => {
    expect(percentageChange(100, 125)).toEqual({ percentage: 25, direction: "up" });
    expect(percentageChange(100, 80)).toEqual({ percentage: 20, direction: "down" });
    expect(percentageChange(0, 50)).toEqual({ percentage: 0, direction: "neutral" });
  });
});

describe("currency — edge-case guards", () => {
  it("never renders NaN/Infinity into a formatted string", () => {
    expect(formatInrCrores(Number.NaN)).toBe("—");
    expect(formatUsdMillions(Number.POSITIVE_INFINITY)).toBe("—");
    expect(formatCurrency(Number.NaN, "INR")).toBe("—");
    expect(formatCurrency(Number.POSITIVE_INFINITY, "USD")).toBe("—");
  });

  it("percentageChange stays neutral on non-finite input", () => {
    expect(percentageChange(100, Number.NaN)).toEqual({ percentage: 0, direction: "neutral" });
    expect(percentageChange(Number.NaN, 5)).toEqual({ percentage: 0, direction: "neutral" });
  });

  it("strictly parses [symbol] number [unit] and rejects everything else", () => {
    // valid forms scale correctly
    expect(parseCurrencyInput("1234", "USD")).toBe(1234);
    expect(parseCurrencyInput("2M", "USD")).toBe(2_000_000);
    expect(parseCurrencyInput("$2.5M", "USD")).toBe(2_500_000);
    expect(parseCurrencyInput("5.68 Cr", "INR")).toBe(56_800_000);
    expect(parseCurrencyInput("₹5.68 Cr", "INR")).toBe(56_800_000);
    expect(parseCurrencyInput("5 crore", "INR")).toBe(50_000_000);
    expect(parseCurrencyInput("3 crores", "INR")).toBe(30_000_000);
    expect(parseCurrencyInput("10 million", "USD")).toBe(10_000_000);
    expect(parseCurrencyInput("10mn", "USD")).toBe(10_000_000);
    expect(parseCurrencyInput("1,000", "USD")).toBe(1000); // pure thousands grouping

    // malformed / ambiguous → null (never a silently wrong number)
    expect(parseCurrencyInput("1-2-3", "USD")).toBeNull();
    expect(parseCurrencyInput("1.2.3", "USD")).toBeNull();
    expect(parseCurrencyInput("", "USD")).toBeNull();
    expect(parseCurrencyInput("abc", "USD")).toBeNull();
    expect(parseCurrencyInput("2.5e6", "USD")).toBeNull(); // scientific notation, not 2.56
    expect(parseCurrencyInput("12,5", "INR")).toBeNull(); // decimal-comma, not 125
    expect(parseCurrencyInput("5 (amt)", "USD")).toBeNull();
    expect(parseCurrencyInput("5 minimum", "USD")).toBeNull();
    expect(parseCurrencyInput("12 across", "INR")).toBeNull();

    // a recognised unit that mismatches the currency → null, not a silent 1e6/1e7 drop
    expect(parseCurrencyInput("5 million", "INR")).toBeNull();
    expect(parseCurrencyInput("5 cr", "USD")).toBeNull();
  });
});
