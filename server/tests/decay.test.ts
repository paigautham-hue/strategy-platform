/**
 * Unit tests — Confidence Decay (server/memory/decay.ts)
 * IMPLEMENTATION_PLAN.md Workstream 1.4 · MEMORY_AND_LEARNING_REVIEW.md D1/D3
 */

import { describe, it, expect } from "vitest";
import {
  ageInDays,
  effectiveConfidence,
  effectiveConfidenceAsOf,
  HALF_LIFE_DAYS,
  CONFIDENCE_FLOOR,
} from "../memory/decay";

describe("decay — ageInDays", () => {
  it("computes elapsed days", () => {
    const now = new Date("2026-05-21T00:00:00Z");
    expect(ageInDays(new Date("2026-05-20T00:00:00Z"), now)).toBeCloseTo(1, 6);
    expect(ageInDays(new Date("2026-05-14T00:00:00Z"), now)).toBeCloseTo(7, 6);
  });

  it("clamps a future date to age 0", () => {
    const now = new Date("2026-05-21T00:00:00Z");
    expect(ageInDays(new Date("2026-06-01T00:00:00Z"), now)).toBe(0);
  });
});

describe("decay — effectiveConfidence", () => {
  it("permanent claims never decay", () => {
    expect(effectiveConfidence(0.9, "permanent", 100000)).toBe(0.9);
  });

  it("at age 0 the effective confidence equals the stored value", () => {
    expect(effectiveConfidence(0.8, "slow", 0)).toBeCloseTo(0.8, 10);
    expect(effectiveConfidence(0.8, "fast", 0)).toBeCloseTo(0.8, 10);
    expect(effectiveConfidence(0.8, "ephemeral", 0)).toBeCloseTo(0.8, 10);
  });

  it("at one half-life, confidence is halfway from stored to the floor", () => {
    // halfway point = floor + (stored - floor) / 2
    const stored = 0.9;
    const halfway = CONFIDENCE_FLOOR + (stored - CONFIDENCE_FLOOR) / 2;
    expect(effectiveConfidence(stored, "fast", HALF_LIFE_DAYS.fast!)).toBeCloseTo(halfway, 10);
    expect(effectiveConfidence(stored, "slow", HALF_LIFE_DAYS.slow!)).toBeCloseTo(halfway, 10);
    expect(
      effectiveConfidence(stored, "ephemeral", HALF_LIFE_DAYS.ephemeral!),
    ).toBeCloseTo(halfway, 10);
  });

  it("decays toward the floor over long ages, never below it", () => {
    const eff = effectiveConfidence(0.95, "ephemeral", 365);
    expect(eff).toBeGreaterThanOrEqual(CONFIDENCE_FLOOR);
    expect(eff).toBeLessThan(0.2); // a year is ~26 ephemeral half-lives
  });

  it("ephemeral decays faster than fast, which decays faster than slow", () => {
    const age = 90;
    const eph = effectiveConfidence(0.9, "ephemeral", age);
    const fast = effectiveConfidence(0.9, "fast", age);
    const slow = effectiveConfidence(0.9, "slow", age);
    expect(eph).toBeLessThan(fast);
    expect(fast).toBeLessThan(slow);
  });

  it("a claim already at/below the floor is returned unchanged", () => {
    expect(effectiveConfidence(0.1, "fast", 1000)).toBe(0.1);
    expect(effectiveConfidence(0.05, "fast", 1000)).toBeCloseTo(0.05, 10);
  });

  it("the result never exceeds stored confidence", () => {
    for (const cls of ["slow", "fast", "ephemeral"] as const) {
      for (const age of [0, 10, 100, 1000]) {
        const eff = effectiveConfidence(0.7, cls, age);
        expect(eff).toBeLessThanOrEqual(0.7 + 1e-9);
        expect(eff).toBeGreaterThanOrEqual(CONFIDENCE_FLOOR - 1e-9);
      }
    }
  });

  it("clamps an out-of-range stored confidence", () => {
    expect(effectiveConfidence(1.5, "permanent", 0)).toBe(1);
    expect(effectiveConfidence(-0.5, "fast", 10)).toBe(0);
  });
});

describe("decay — effectiveConfidenceAsOf", () => {
  it("decays from an ingestion date", () => {
    const ingestedAt = new Date("2026-02-20T00:00:00Z");
    const now = new Date("2026-05-21T00:00:00Z"); // ~90 days later
    const eff = effectiveConfidenceAsOf(0.9, "fast", ingestedAt, now);
    // ~90 days ≈ one 'fast' half-life → roughly halfway to the floor
    const halfway = CONFIDENCE_FLOOR + (0.9 - CONFIDENCE_FLOOR) / 2;
    expect(eff).toBeCloseTo(halfway, 1);
  });
});
