/**
 * Unit tests — Pattern Distillation (server/services/distillation.ts)
 * IMPLEMENTATION_PLAN.md Phase 7 / Workstream 7.2
 */

import { describe, it, expect } from "vitest";
import {
  MIN_PORTCOS_FOR_PUBLICATION,
  canPublishPattern,
  anonymizeText,
  distillPattern,
  aggregateStat,
} from "../services/distillation";

describe("distillation — canPublishPattern", () => {
  it("requires at least the minimum portco count", () => {
    expect(MIN_PORTCOS_FOR_PUBLICATION).toBe(3);
    expect(canPublishPattern(2)).toBe(false);
    expect(canPublishPattern(3)).toBe(true);
    expect(canPublishPattern(7)).toBe(true);
  });
});

describe("distillation — anonymizeText", () => {
  it("strips company names, case-insensitively", () => {
    const r = anonymizeText("Acme Health grew fast; acme health led the segment.", [
      "Acme Health",
    ]);
    expect(r.text).not.toMatch(/acme/i);
    expect(r.text).toContain("a portfolio company");
    expect(r.redactionCount).toBe(2);
  });

  it("redacts currency amounts", () => {
    const r = anonymizeText("They raised $4.2M and spent $450,000 on GTM.", []);
    expect(r.text).not.toContain("$4.2M");
    expect(r.text).not.toContain("$450,000");
    expect(r.text).toContain("[amount]");
    expect(r.redactionCount).toBe(2);
  });

  it("redacts specific dates", () => {
    const r = anonymizeText("Launched March 2024; closed on 2024-06-01 and Jan 5, 2025.", []);
    expect(r.text).not.toContain("March 2024");
    expect(r.text).not.toContain("2024-06-01");
    expect(r.text).not.toContain("Jan 5, 2025");
    expect(r.text).toContain("[date]");
  });

  it("matches the longest company name first", () => {
    const r = anonymizeText("Acme Health Co is part of the group.", ["Acme", "Acme Health Co"]);
    expect(r.text).toBe("a portfolio company is part of the group.");
  });

  it("leaves clean text untouched", () => {
    const r = anonymizeText("The pattern is about pricing discipline.", ["Acme"]);
    expect(r.redactionCount).toBe(0);
  });
});

describe("distillation — distillPattern", () => {
  it("anonymizes and clears the gate when enough portcos contributed", () => {
    const r = distillPattern({
      patternText: "Acme moved upmarket and won $2M deals.",
      companyNames: ["Acme"],
      sourcePortcoCount: 4,
    });
    expect(r.publishable).toBe(true);
    expect(r.anonymizedText).not.toMatch(/acme/i);
    expect(r.anonymizedText).toContain("[amount]");
    expect(r.redactionCount).toBe(2);
  });

  it("blocks publication below the min-portco gate", () => {
    const r = distillPattern({
      patternText: "A clean pattern.",
      companyNames: [],
      sourcePortcoCount: 2,
    });
    expect(r.publishable).toBe(false);
    expect(r.reason).toContain("at least 3");
  });
});

describe("distillation — aggregateStat", () => {
  it("aggregates a publishable statistic", () => {
    const s = aggregateStat("payback months", [12, 14, 18, 14]);
    expect(s).not.toBeNull();
    expect(s!.n).toBe(4);
    expect(s!.median).toBe(14);
    expect(s!.min).toBe(12);
    expect(s!.max).toBe(18);
  });

  it("returns null below the minimum sample", () => {
    expect(aggregateStat("x", [10, 20])).toBeNull();
  });
});
