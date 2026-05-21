/**
 * Unit tests — Source Trust & Confidence Aggregation (server/extraction/source-trust.ts)
 * IMPLEMENTATION_PLAN.md Workstream 1.4 · Critical Patterns C21, C24 · technique T12
 */

import { describe, it, expect } from "vitest";
import {
  extractDomain,
  trustScoreForDomain,
  trustScoreForUrl,
  bayesianConfidence,
  shouldQuarantine,
  DEFAULT_SOURCE_TRUST,
  QUARANTINE_TRUST_THRESHOLD,
} from "../extraction/source-trust";

describe("source-trust — extractDomain", () => {
  it("extracts a plain registrable domain", () => {
    expect(extractDomain("https://www.sec.gov/cgi-bin/browse")).toBe("sec.gov");
    expect(extractDomain("https://reuters.com/article/x")).toBe("reuters.com");
    expect(extractDomain("http://example.com")).toBe("example.com");
  });

  it("handles two-level public suffixes", () => {
    expect(extractDomain("https://blog.example.co.uk/post")).toBe("example.co.uk");
    expect(extractDomain("https://www.companieshouse.gov.uk")).toBe("companieshouse.gov.uk");
  });

  it("lower-cases the host", () => {
    expect(extractDomain("https://WWW.SEC.GOV/x")).toBe("sec.gov");
  });

  it("returns null for non-http(s) or unparseable input", () => {
    expect(extractDomain("ftp://example.com")).toBeNull();
    expect(extractDomain("not a url")).toBeNull();
    expect(extractDomain("")).toBeNull();
  });
});

describe("source-trust — trustScoreForDomain", () => {
  it("returns the seeded score for known domains", () => {
    expect(trustScoreForDomain("sec.gov")).toBe(0.95);
    expect(trustScoreForDomain("reuters.com")).toBe(0.85);
    expect(trustScoreForDomain("reddit.com")).toBe(0.35);
  });

  it("returns the default for unknown domains", () => {
    expect(trustScoreForDomain("some-random-blog.net")).toBe(DEFAULT_SOURCE_TRUST);
  });

  it("runtime overrides take precedence over the seed table", () => {
    const overrides = new Map([["sec.gov", 0.99], ["my-internal-wiki.local", 0.8]]);
    expect(trustScoreForDomain("sec.gov", overrides)).toBe(0.99);
    expect(trustScoreForDomain("my-internal-wiki.local", overrides)).toBe(0.8);
  });

  it("is case-insensitive", () => {
    expect(trustScoreForDomain("SEC.GOV")).toBe(0.95);
  });

  it("trustScoreForUrl extracts the domain then scores it", () => {
    expect(trustScoreForUrl("https://www.sec.gov/filings/123")).toBe(0.95);
    expect(trustScoreForUrl("not a url")).toBe(DEFAULT_SOURCE_TRUST);
  });
});

describe("source-trust — bayesianConfidence (C21)", () => {
  it("no sources → 0", () => {
    expect(bayesianConfidence([])).toBe(0);
  });

  it("a single source → that source's trust", () => {
    expect(bayesianConfidence([0.8])).toBeCloseTo(0.8, 10);
  });

  it("corroboration raises confidence and saturates toward 1", () => {
    // two independent 0.8 sources: 1 - 0.2*0.2 = 0.96
    expect(bayesianConfidence([0.8, 0.8])).toBeCloseTo(0.96, 10);
    // three: 1 - 0.2^3 = 0.992
    expect(bayesianConfidence([0.8, 0.8, 0.8])).toBeCloseTo(0.992, 10);
  });

  it("two weak sources still combine sensibly", () => {
    // 1 - 0.5*0.5 = 0.75
    expect(bayesianConfidence([0.5, 0.5])).toBeCloseTo(0.75, 10);
  });

  it("a zero-trust source contributes nothing", () => {
    expect(bayesianConfidence([0, 0.8])).toBeCloseTo(0.8, 10);
  });

  it("a perfect source pins confidence at 1", () => {
    expect(bayesianConfidence([1])).toBe(1);
    expect(bayesianConfidence([1, 0.3])).toBe(1);
  });

  it("result is always within [0, 1]", () => {
    const c = bayesianConfidence([0.9, 0.9, 0.9, 0.9, 0.9]);
    expect(c).toBeGreaterThanOrEqual(0);
    expect(c).toBeLessThanOrEqual(1);
  });
});

describe("source-trust — shouldQuarantine (C24)", () => {
  it("quarantines a low-trust, uncorroborated claim", () => {
    expect(shouldQuarantine(0.3, 1)).toBe(true);
    expect(shouldQuarantine(0.3, 0)).toBe(true);
  });

  it("releases a low-trust claim once it has 2+ distinct corroborating sources", () => {
    expect(shouldQuarantine(0.3, 2)).toBe(false);
    expect(shouldQuarantine(0.3, 5)).toBe(false);
  });

  it("never quarantines a claim from a trusted source", () => {
    expect(shouldQuarantine(0.85, 0)).toBe(false);
    expect(shouldQuarantine(QUARANTINE_TRUST_THRESHOLD, 0)).toBe(false); // exactly at threshold
  });
});
