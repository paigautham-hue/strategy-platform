/**
 * Unit tests — Memory Reflection output normalisation
 * server/cron/memory-reflection.ts · IMPLEMENTATION_PLAN.md Workstream 1.4 / T5
 */

import { describe, it, expect } from "vitest";
import { normalizeReflectionOutput } from "../cron/memory-reflection";

describe("memory-reflection — normalizeReflectionOutput", () => {
  it("normalizes well-formed insights", () => {
    const out = normalizeReflectionOutput({
      insights: [
        { insight: "Rising CAC and long sales cycles point to a GTM-efficiency problem.", rationale: "Two claims converge." },
        { insight: "Deep ERP integration is the durable moat.", rationale: "Low churn supports it." },
      ],
    });
    expect(out).toHaveLength(2);
    expect(out[0].insight).toContain("GTM-efficiency");
    expect(out[0].rationale).toBe("Two claims converge.");
  });

  it("returns [] for non-object or missing insights", () => {
    expect(normalizeReflectionOutput(null)).toEqual([]);
    expect(normalizeReflectionOutput({})).toEqual([]);
    expect(normalizeReflectionOutput({ insights: "nope" })).toEqual([]);
  });

  it("skips items with no insight text", () => {
    const out = normalizeReflectionOutput({
      insights: [{ rationale: "orphan rationale" }, { insight: "A real insight." }],
    });
    expect(out).toHaveLength(1);
    expect(out[0].insight).toBe("A real insight.");
  });

  it("tolerates a missing rationale", () => {
    const out = normalizeReflectionOutput({ insights: [{ insight: "Standalone insight." }] });
    expect(out[0].rationale).toBe("");
  });

  it("ignores non-object items", () => {
    const out = normalizeReflectionOutput({
      insights: [null, "string", 7, { insight: "Only real one." }],
    });
    expect(out).toHaveLength(1);
  });

  it("caps the number of insights at 5", () => {
    const out = normalizeReflectionOutput({
      insights: Array.from({ length: 12 }, (_, i) => ({ insight: `Insight ${i}` })),
    });
    expect(out).toHaveLength(5);
  });

  it("trims whitespace from insight and rationale", () => {
    const out = normalizeReflectionOutput({
      insights: [{ insight: "  spaced insight  ", rationale: "  spaced rationale  " }],
    });
    expect(out[0].insight).toBe("spaced insight");
    expect(out[0].rationale).toBe("spaced rationale");
  });
});
