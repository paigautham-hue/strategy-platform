/**
 * Unit tests — KPI Definition Library (server/services/kpi-library.ts)
 * IMPLEMENTATION_PLAN.md Phase 5 / Workstream 5.3
 */

import { describe, it, expect } from "vitest";
import {
  KPI_DEFINITIONS,
  listKpis,
  getKpi,
  computeKpi,
  formatKpiValue,
} from "../services/kpi-library";

describe("kpi-library — catalog", () => {
  it("listKpis returns every definition without the compute function", () => {
    const list = listKpis();
    expect(list.length).toBe(KPI_DEFINITIONS.length);
    for (const entry of list) {
      expect("compute" in entry).toBe(false);
      expect(entry.inputs.length).toBeGreaterThan(0);
    }
  });

  it("every KPI id is unique", () => {
    const ids = KPI_DEFINITIONS.map((k) => k.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("kpi-library — computeKpi", () => {
  it("computes CAC", () => {
    const r = computeKpi("cac", { salesMarketingSpend: 100000, newCustomers: 50 });
    expect(r?.value).toBe(2000);
    expect(r?.formatted).toBe("$2,000");
  });

  it("computes net revenue retention as a percentage", () => {
    const r = computeKpi("nrr", {
      startingRevenue: 1000,
      expansion: 200,
      contraction: 50,
      churn: 50,
    });
    expect(r?.value).toBe(110);
    expect(r?.formatted).toBe("110%");
  });

  it("computes the LTV:CAC ratio", () => {
    const r = computeKpi("ltv_cac", { ltv: 9000, cac: 3000 });
    expect(r?.value).toBe(3);
    expect(r?.formatted).toBe("3×");
  });

  it("computes CAC payback in months", () => {
    const r = computeKpi("cac_payback", {
      cac: 1200,
      monthlyArpa: 200,
      grossMarginPct: 80,
    });
    expect(r?.value).toBe(7.5);
    expect(r?.formatted).toBe("7.5 mo");
  });

  it("computes the Rule of 40", () => {
    const r = computeKpi("rule_of_40", { growthRatePct: 28, profitMarginPct: 15 });
    expect(r?.value).toBe(43);
  });

  it("computes cash runway", () => {
    const r = computeKpi("runway", { cashBalance: 2_400_000, monthlyNetBurn: 200_000 });
    expect(r?.value).toBe(12);
  });

  it("returns null on a zero denominator", () => {
    expect(computeKpi("cac", { salesMarketingSpend: 1000, newCustomers: 0 })).toBeNull();
    expect(computeKpi("burn_multiple", { netBurn: 500, netNewArr: 0 })).toBeNull();
  });

  it("returns null for an unknown KPI id", () => {
    expect(computeKpi("not_a_kpi", {})).toBeNull();
  });
});

describe("kpi-library — getKpi + formatKpiValue", () => {
  it("looks up a definition by id", () => {
    expect(getKpi("arr")?.label).toBe("Annual Recurring Revenue");
    expect(getKpi("missing")).toBeUndefined();
  });

  it("formats values by unit", () => {
    expect(formatKpiValue(5000, "currency")).toBe("$5,000");
    expect(formatKpiValue(42, "percent")).toBe("42%");
    expect(formatKpiValue(3.5, "ratio")).toBe("3.5×");
    expect(formatKpiValue(9, "months")).toBe("9 mo");
    expect(formatKpiValue(120, "count")).toBe("120");
  });
});
