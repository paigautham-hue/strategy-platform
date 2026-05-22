/**
 * KPI Definition Library — IMPLEMENTATION_PLAN.md Phase 5, Workstream 5.3
 *
 * A reusable catalog of the standard operating KPIs a strategy platform must
 * understand — CAC, payback, NRR, LTV, Rule of 40, burn multiple, runway, and
 * the rest. Each definition carries its inputs, a human-readable formula, a
 * unit, a direction (is higher better?), and a PURE compute function.
 *
 * This library is what KPI sync (when connectors land) maps live metrics
 * onto, and what the OKR auto-mapper matches declared key results against.
 * Everything here is pure and deterministic — fully unit-tested.
 */

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type KpiCategory =
  | "growth"
  | "efficiency"
  | "retention"
  | "unit-economics"
  | "liquidity";

export type KpiUnit = "currency" | "ratio" | "percent" | "months" | "count";

export interface KpiInput {
  id: string;
  label: string;
}

export interface KpiDefinition {
  id: string;
  label: string;
  description: string;
  category: KpiCategory;
  inputs: KpiInput[];
  /** A human-readable formula. */
  formula: string;
  unit: KpiUnit;
  /** Is a higher value better? (false e.g. for CAC, payback, burn multiple). */
  higherIsBetter: boolean;
  /** Pure computation from named inputs; returns null on an undefined result. */
  compute: (inputs: Record<string, number>) => number | null;
}

/** The catalog view — a definition without its (non-serialisable) compute fn. */
export type KpiCatalogEntry = Omit<KpiDefinition, "compute">;

// ─────────────────────────────────────────────────────────────────────────────
// COMPUTE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Safe division — null when the denominator is zero or non-finite. */
function div(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return null;
  }
  return numerator / denominator;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function n(inputs: Record<string, number>, key: string): number {
  const v = inputs[key];
  return typeof v === "number" && Number.isFinite(v) ? v : NaN;
}

// ─────────────────────────────────────────────────────────────────────────────
// THE CATALOG
// ─────────────────────────────────────────────────────────────────────────────

export const KPI_DEFINITIONS: readonly KpiDefinition[] = [
  // ── Unit economics ──────────────────────────────────────────────────────────
  {
    id: "cac",
    label: "Customer Acquisition Cost",
    description: "What it costs, fully loaded, to acquire one new customer.",
    category: "unit-economics",
    inputs: [
      { id: "salesMarketingSpend", label: "Sales & marketing spend" },
      { id: "newCustomers", label: "New customers acquired" },
    ],
    formula: "Sales & marketing spend ÷ new customers acquired",
    unit: "currency",
    higherIsBetter: false,
    compute: (i) => {
      const r = div(n(i, "salesMarketingSpend"), n(i, "newCustomers"));
      return r === null ? null : round2(r);
    },
  },
  {
    id: "ltv",
    label: "Lifetime Value",
    description: "The gross-margin revenue an average customer delivers over their lifetime.",
    category: "unit-economics",
    inputs: [
      { id: "annualArpa", label: "Annual revenue per account" },
      { id: "grossMarginPct", label: "Gross margin (%)" },
      { id: "annualChurnPct", label: "Annual revenue churn (%)" },
    ],
    formula: "(Annual ARPA × gross margin %) ÷ annual churn %",
    unit: "currency",
    higherIsBetter: true,
    compute: (i) => {
      const r = div(n(i, "annualArpa") * (n(i, "grossMarginPct") / 100), n(i, "annualChurnPct") / 100);
      return r === null ? null : round2(r);
    },
  },
  {
    id: "ltv_cac",
    label: "LTV : CAC Ratio",
    description: "Lifetime value relative to acquisition cost — 3× or better is healthy.",
    category: "unit-economics",
    inputs: [
      { id: "ltv", label: "Lifetime value" },
      { id: "cac", label: "Customer acquisition cost" },
    ],
    formula: "LTV ÷ CAC",
    unit: "ratio",
    higherIsBetter: true,
    compute: (i) => {
      const r = div(n(i, "ltv"), n(i, "cac"));
      return r === null ? null : round2(r);
    },
  },
  {
    id: "cac_payback",
    label: "CAC Payback Period",
    description: "Months of gross-margin revenue needed to recover acquisition cost.",
    category: "unit-economics",
    inputs: [
      { id: "cac", label: "Customer acquisition cost" },
      { id: "monthlyArpa", label: "Monthly revenue per account" },
      { id: "grossMarginPct", label: "Gross margin (%)" },
    ],
    formula: "CAC ÷ (monthly ARPA × gross margin %)",
    unit: "months",
    higherIsBetter: false,
    compute: (i) => {
      const r = div(n(i, "cac"), n(i, "monthlyArpa") * (n(i, "grossMarginPct") / 100));
      return r === null ? null : round2(r);
    },
  },

  // ── Retention ───────────────────────────────────────────────────────────────
  {
    id: "nrr",
    label: "Net Revenue Retention",
    description: "Revenue kept from existing customers including expansion — above 100% is growth without new logos.",
    category: "retention",
    inputs: [
      { id: "startingRevenue", label: "Starting revenue" },
      { id: "expansion", label: "Expansion revenue" },
      { id: "contraction", label: "Contraction revenue" },
      { id: "churn", label: "Churned revenue" },
    ],
    formula: "(Starting + expansion − contraction − churn) ÷ starting × 100",
    unit: "percent",
    higherIsBetter: true,
    compute: (i) => {
      const r = div(
        n(i, "startingRevenue") + n(i, "expansion") - n(i, "contraction") - n(i, "churn"),
        n(i, "startingRevenue"),
      );
      return r === null ? null : round2(r * 100);
    },
  },
  {
    id: "grr",
    label: "Gross Revenue Retention",
    description: "Revenue kept from existing customers excluding expansion — caps at 100%.",
    category: "retention",
    inputs: [
      { id: "startingRevenue", label: "Starting revenue" },
      { id: "contraction", label: "Contraction revenue" },
      { id: "churn", label: "Churned revenue" },
    ],
    formula: "(Starting − contraction − churn) ÷ starting × 100",
    unit: "percent",
    higherIsBetter: true,
    compute: (i) => {
      const r = div(
        n(i, "startingRevenue") - n(i, "contraction") - n(i, "churn"),
        n(i, "startingRevenue"),
      );
      return r === null ? null : round2(r * 100);
    },
  },
  {
    id: "logo_retention",
    label: "Logo Retention",
    description: "The share of customers retained over the period, by count.",
    category: "retention",
    inputs: [
      { id: "startingCustomers", label: "Starting customers" },
      { id: "churnedCustomers", label: "Churned customers" },
    ],
    formula: "(Starting customers − churned) ÷ starting × 100",
    unit: "percent",
    higherIsBetter: true,
    compute: (i) => {
      const r = div(n(i, "startingCustomers") - n(i, "churnedCustomers"), n(i, "startingCustomers"));
      return r === null ? null : round2(r * 100);
    },
  },

  // ── Growth ──────────────────────────────────────────────────────────────────
  {
    id: "arr",
    label: "Annual Recurring Revenue",
    description: "Annualised run-rate of recurring revenue.",
    category: "growth",
    inputs: [{ id: "mrr", label: "Monthly recurring revenue" }],
    formula: "MRR × 12",
    unit: "currency",
    higherIsBetter: true,
    compute: (i) => {
      const mrr = n(i, "mrr");
      return Number.isFinite(mrr) ? round2(mrr * 12) : null;
    },
  },
  {
    id: "growth_rate",
    label: "Growth Rate",
    description: "Period-over-period growth in a metric.",
    category: "growth",
    inputs: [
      { id: "currentPeriod", label: "Current period value" },
      { id: "priorPeriod", label: "Prior period value" },
    ],
    formula: "(Current − prior) ÷ prior × 100",
    unit: "percent",
    higherIsBetter: true,
    compute: (i) => {
      const r = div(n(i, "currentPeriod") - n(i, "priorPeriod"), n(i, "priorPeriod"));
      return r === null ? null : round2(r * 100);
    },
  },
  {
    id: "rule_of_40",
    label: "Rule of 40",
    description: "Growth rate plus profit margin — 40 or above is the benchmark for healthy software.",
    category: "growth",
    inputs: [
      { id: "growthRatePct", label: "Growth rate (%)" },
      { id: "profitMarginPct", label: "Profit margin (%)" },
    ],
    formula: "Growth rate % + profit margin %",
    unit: "percent",
    higherIsBetter: true,
    compute: (i) => {
      const g = n(i, "growthRatePct");
      const p = n(i, "profitMarginPct");
      return Number.isFinite(g) && Number.isFinite(p) ? round2(g + p) : null;
    },
  },
  {
    id: "magic_number",
    label: "Sales Efficiency (Magic Number)",
    description: "Net new ARR generated per dollar of prior-period sales & marketing spend.",
    category: "growth",
    inputs: [
      { id: "netNewArr", label: "Net new ARR" },
      { id: "priorSalesMarketingSpend", label: "Prior-period S&M spend" },
    ],
    formula: "Net new ARR ÷ prior-period S&M spend",
    unit: "ratio",
    higherIsBetter: true,
    compute: (i) => {
      const r = div(n(i, "netNewArr"), n(i, "priorSalesMarketingSpend"));
      return r === null ? null : round2(r);
    },
  },

  // ── Efficiency ──────────────────────────────────────────────────────────────
  {
    id: "gross_margin",
    label: "Gross Margin",
    description: "The share of revenue left after the direct cost of delivering it.",
    category: "efficiency",
    inputs: [
      { id: "revenue", label: "Revenue" },
      { id: "cogs", label: "Cost of goods sold" },
    ],
    formula: "(Revenue − COGS) ÷ revenue × 100",
    unit: "percent",
    higherIsBetter: true,
    compute: (i) => {
      const r = div(n(i, "revenue") - n(i, "cogs"), n(i, "revenue"));
      return r === null ? null : round2(r * 100);
    },
  },
  {
    id: "burn_multiple",
    label: "Burn Multiple",
    description: "Net cash burned per dollar of net new ARR — below 1.5× is efficient.",
    category: "efficiency",
    inputs: [
      { id: "netBurn", label: "Net cash burn" },
      { id: "netNewArr", label: "Net new ARR" },
    ],
    formula: "Net burn ÷ net new ARR",
    unit: "ratio",
    higherIsBetter: false,
    compute: (i) => {
      const r = div(n(i, "netBurn"), n(i, "netNewArr"));
      return r === null ? null : round2(r);
    },
  },

  // ── Liquidity ───────────────────────────────────────────────────────────────
  {
    id: "runway",
    label: "Cash Runway",
    description: "Months of operation remaining at the current burn rate.",
    category: "liquidity",
    inputs: [
      { id: "cashBalance", label: "Cash balance" },
      { id: "monthlyNetBurn", label: "Monthly net burn" },
    ],
    formula: "Cash balance ÷ monthly net burn",
    unit: "months",
    higherIsBetter: true,
    compute: (i) => {
      const r = div(n(i, "cashBalance"), n(i, "monthlyNetBurn"));
      return r === null ? null : round2(r);
    },
  },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// LOOKUP + FORMATTING
// ─────────────────────────────────────────────────────────────────────────────

/** The catalog without compute functions — safe to send to the client. Pure. */
export function listKpis(): KpiCatalogEntry[] {
  return KPI_DEFINITIONS.map(({ compute: _compute, ...rest }) => rest);
}

/** Look up a KPI definition by id. Pure. */
export function getKpi(id: string): KpiDefinition | undefined {
  return KPI_DEFINITIONS.find((k) => k.id === id);
}

export interface KpiResult {
  id: string;
  label: string;
  value: number;
  unit: KpiUnit;
  formatted: string;
}

/** Format a KPI value for display given its unit. Pure — exported for tests. */
export function formatKpiValue(value: number, unit: KpiUnit): string {
  switch (unit) {
    case "currency":
      return `$${value.toLocaleString("en-US")}`;
    case "percent":
      return `${value}%`;
    case "ratio":
      return `${value}×`;
    case "months":
      return `${value} mo`;
    case "count":
      return `${value}`;
    default:
      return `${value}`;
  }
}

/**
 * Compute a KPI from named inputs. Returns null when the KPI is unknown or the
 * formula has no defined result (e.g. division by zero). Pure.
 */
export function computeKpi(id: string, inputs: Record<string, number>): KpiResult | null {
  const def = getKpi(id);
  if (!def) return null;
  const value = def.compute(inputs);
  if (value === null) return null;
  return {
    id: def.id,
    label: def.label,
    value,
    unit: def.unit,
    formatted: formatKpiValue(value, def.unit),
  };
}
