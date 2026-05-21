/**
 * Unit tests — Share-and-Apply Micro War-Game (server/agents/apply-war-game.ts)
 * IMPLEMENTATION_PLAN.md Phase 3 / Workstream 3.5
 */

import { describe, it, expect } from "vitest";
import {
  buildAppliedStrategyText,
  normalizeComparison,
} from "../agents/apply-war-game";
import type { StrategyArtifact } from "../services/strategy-artifact";
import type { StrategyApplication } from "../agents/apply-strategy";

const artifact = (over: Partial<StrategyArtifact> = {}): StrategyArtifact => ({
  isStrategyArtifact: true,
  artifactType: "playbook",
  title: "Land-and-expand",
  coreThesis: "Win a small beachhead, then expand seat by seat.",
  preconditions: ["Self-serve onboarding"],
  keyMoves: ["Ship a free tier", "Add usage-based upsell"],
  expectedOutcomes: ["Net revenue retention above 120%"],
  contextOfOrigin: "B2B SaaS, 2015-2020",
  attribution: "A SaaS operator",
  classifierConfidence: 0.9,
  ...over,
});

const application = (over: Partial<StrategyApplication> = {}): StrategyApplication => ({
  fitScore: 70,
  fitRationale: "Reasonable fit.",
  gaps: [],
  adaptedMoves: [
    { original: "Ship a free tier", adapted: "Ship a 14-day trial — the segment will not adopt free." },
  ],
  risks: [],
  recommendation: "adapt-heavily — trial instead of free tier",
  applicationMemo: "memo",
  ...over,
});

describe("apply-war-game — buildAppliedStrategyText", () => {
  it("prefers the adapted moves over the artifact's raw moves", () => {
    const text = buildAppliedStrategyText(artifact(), application());
    expect(text).toContain("Land-and-expand");
    expect(text).toContain("Ship a 14-day trial");
    expect(text).not.toContain("- Ship a free tier");
  });

  it("falls back to artifact key moves when there are no adapted moves", () => {
    const text = buildAppliedStrategyText(artifact(), application({ adaptedMoves: [] }));
    expect(text).toContain("- Ship a free tier");
    expect(text).toContain("- Add usage-based upsell");
  });

  it("uses the original move text when an adapted move has no adapted text", () => {
    const text = buildAppliedStrategyText(
      artifact(),
      application({ adaptedMoves: [{ original: "Hire a head of growth", adapted: "" }] }),
    );
    expect(text).toContain("Hire a head of growth");
  });
});

describe("apply-war-game — normalizeComparison", () => {
  it("normalizes a well-formed comparison", () => {
    const c = normalizeComparison({
      alignment: "aligned",
      comparison: "The simulation matched the expected retention lift.",
      adjustedRecommendation: "pursue",
    });
    expect(c.alignment).toBe("aligned");
    expect(c.comparison).toContain("retention");
    expect(c.adjustedRecommendation).toBe("pursue");
  });

  it("lower-cases and accepts a valid alignment", () => {
    expect(normalizeComparison({ alignment: "DIVERGES", comparison: "x" }).alignment).toBe("diverges");
  });

  it("defaults an unknown alignment to partial", () => {
    expect(normalizeComparison({ alignment: "perfect", comparison: "x" }).alignment).toBe("partial");
  });

  it("supplies fallbacks for a non-object payload", () => {
    const c = normalizeComparison(null);
    expect(c.alignment).toBe("partial");
    expect(c.comparison).toBe("The simulation produced no clear comparison.");
    expect(c.adjustedRecommendation).toBe("No adjusted recommendation produced.");
  });
});
