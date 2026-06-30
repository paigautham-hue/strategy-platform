/**
 * Dual-Currency (USD ↔ INR Crore) — IMPLEMENTATION_PLAN.md Phase 5 (operator UX)
 *
 * Salvaged from the StrategyForge prototype (server/currencyService.ts) and made
 * PURE during the prototype-consolidation pass. The anchor customer (MGPS)
 * reports in ₹ Crore, so every financial surface needs USD↔INR-Crore conversion
 * and crore/million formatting.
 *
 * Deliberately pure: the exchange RATE is an injected parameter (defaulting to a
 * documented fallback), NOT fetched here. A live rate must arrive through a
 * registered MCP tool (C3 — no third-party HTTP inside domain code); wiring that
 * `fx_rate` tool is the follow-up. Until then callers pass an explicit rate or
 * accept the fallback. Everything here is pure and deterministic — unit-tested.
 */

/** 1 crore = 10,000,000. */
export const CRORE = 10_000_000;
/** 1 million = 1,000,000. */
export const MILLION = 1_000_000;
/**
 * Fallback USD→INR rate used when no live rate is supplied. Approximate and
 * intentionally explicit — never silently treated as a live quote.
 */
export const FALLBACK_USD_INR = 83.0;

export interface DualCurrencyDisplay {
  /** Formatted USD, in millions (e.g. "$1.20M"). */
  usd: string;
  /** Formatted INR, in crores (e.g. "₹9.96 Cr"). */
  inr: string;
  /** Raw USD amount (absolute units). */
  usdRaw: number;
  /** Raw INR amount (absolute units). */
  inrRaw: number;
  /** The exchange rate applied. */
  rate: number;
}

/** Convert an absolute amount at a given rate (to-units per from-unit). Pure. */
export function convert(amount: number, rate: number): number {
  return amount * rate;
}

/** USD (absolute) → INR crores, at the supplied rate. Pure. */
export function usdToInrCrores(usd: number, rate: number = FALLBACK_USD_INR): number {
  return (usd * rate) / CRORE;
}

/** INR crores → USD (absolute), at the supplied rate. Pure. */
export function inrCroresToUsd(inrCrores: number, rate: number = FALLBACK_USD_INR): number {
  return (inrCrores * CRORE) / rate;
}

/** Format an absolute INR amount as crores (e.g. "₹9.96 Cr"). Non-finite → "—". Pure. */
export function formatInrCrores(inrAbsolute: number): string {
  if (!Number.isFinite(inrAbsolute)) return "—";
  return `₹${(inrAbsolute / CRORE).toFixed(2)} Cr`;
}

/** Format an absolute USD amount as millions (e.g. "$1.20M"). Non-finite → "—". Pure. */
export function formatUsdMillions(usdAbsolute: number): string {
  if (!Number.isFinite(usdAbsolute)) return "—";
  return `$${(usdAbsolute / MILLION).toFixed(2)}M`;
}

/**
 * Format an absolute amount for display given its currency code. INR renders in
 * crores, USD in millions, anything else via Intl. Pure.
 */
export function formatCurrency(amount: number, currencyCode: string): string {
  if (!Number.isFinite(amount)) return "—";
  if (currencyCode === "INR") return formatInrCrores(amount);
  if (currencyCode === "USD") return formatUsdMillions(amount);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Build the dual USD + INR-Crore display from a USD amount at a given rate.
 * The primary helper used across financial surfaces. Pure.
 */
export function dualCurrencyDisplay(
  usdAmount: number,
  rate: number = FALLBACK_USD_INR,
): DualCurrencyDisplay {
  const inrRaw = convert(usdAmount, rate);
  return {
    usd: formatUsdMillions(usdAmount),
    inr: formatInrCrores(inrRaw),
    usdRaw: usdAmount,
    inrRaw,
    rate,
  };
}

/**
 * Parse a user-entered currency string into an absolute number, honouring "Cr"
 * (crore) and "M" (million) suffixes. Returns null on non-numeric input. Pure.
 */
export function parseCurrencyInput(input: string, currencyCode: string): number | null {
  const cleaned = input.replace(/[^0-9.\-]/g, "");
  // Reject malformed input ("1-2-3", "1.2.3", "") rather than silently accepting a partial number.
  if (!/^-?\d*\.?\d+$/.test(cleaned)) return null;
  const parsed = parseFloat(cleaned);
  if (!Number.isFinite(parsed)) return null;

  // Anchor the magnitude suffix to the END so a stray "m"/"cr" mid-string can't
  // misscale, while accepting the common full-word/abbreviated forms.
  const lower = input.trim().toLowerCase();
  if (currencyCode === "INR" && /(?:cr|crores?)\s*$/.test(lower)) return parsed * CRORE;
  if (currencyCode === "USD" && /(?:m|mn|mm|million)\s*$/.test(lower)) return parsed * MILLION;
  return parsed;
}

export interface PercentageChange {
  percentage: number;
  direction: "up" | "down" | "neutral";
}

/** Percentage change between two values, with direction. Pure. */
export function percentageChange(oldValue: number, newValue: number): PercentageChange {
  if (!Number.isFinite(oldValue) || !Number.isFinite(newValue) || oldValue === 0) {
    return { percentage: 0, direction: "neutral" };
  }
  const change = ((newValue - oldValue) / oldValue) * 100;
  const direction = change > 0 ? "up" : change < 0 ? "down" : "neutral";
  return { percentage: Math.round(Math.abs(change) * 100) / 100, direction };
}
