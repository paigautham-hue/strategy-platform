/**
 * Unit tests — Voice Briefing Builder (server/agents/briefing.ts)
 * IMPLEMENTATION_PLAN.md Phase 7 / Workstream 7.6
 */

import { describe, it, expect } from "vitest";
import { normalizeBriefing } from "../agents/briefing";

describe("briefing — normalizeBriefing", () => {
  it("normalizes a well-formed briefing and stamps the cadence", () => {
    const b = normalizeBriefing(
      {
        headline: "Pricing pilot is the week's big move.",
        sections: [
          { heading: "Pricing", body: "Usage-based pilot launched with three accounts." },
          { heading: "Risk", body: "Competitor cut prices 10%." },
        ],
        needsAttention: ["Decide whether to match the price cut"],
        suggestedActions: ["War-game the price-match option"],
      },
      "weekly",
    );
    expect(b.cadence).toBe("weekly");
    expect(b.headline).toContain("Pricing");
    expect(b.sections).toHaveLength(2);
    expect(b.needsAttention).toHaveLength(1);
    expect(b.suggestedActions).toHaveLength(1);
  });

  it("drops sections with no body and defaults a missing heading", () => {
    const b = normalizeBriefing(
      { headline: "h", sections: [{ heading: "", body: "Has body" }, { heading: "Skip" }] },
      "daily",
    );
    expect(b.sections).toHaveLength(1);
    expect(b.sections[0].heading).toBe("Update");
  });

  it("supplies a fallback headline for a non-object payload", () => {
    const b = normalizeBriefing(null, "daily");
    expect(b.cadence).toBe("daily");
    expect(b.headline).toBe("No briefing headline was produced.");
    expect(b.sections).toEqual([]);
    expect(b.needsAttention).toEqual([]);
  });

  it("caps the attention and action lists at 8", () => {
    const b = normalizeBriefing(
      {
        headline: "h",
        needsAttention: [...Array(12).keys()].map((i) => `Item ${i}`),
        suggestedActions: [...Array(12).keys()].map((i) => `Action ${i}`),
      },
      "weekly",
    );
    expect(b.needsAttention).toHaveLength(8);
    expect(b.suggestedActions).toHaveLength(8);
  });
});
