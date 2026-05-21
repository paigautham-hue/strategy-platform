/**
 * Unit tests — Memo Dictation (server/agents/memo-dictation.ts)
 * IMPLEMENTATION_PLAN.md Phase 4 / Workstream 4.5
 */

import { describe, it, expect } from "vitest";
import { normalizeMemo, renderMemoMarkdown } from "../agents/memo-dictation";

describe("memo-dictation — normalizeMemo", () => {
  it("normalizes a well-formed memo", () => {
    const m = normalizeMemo({
      title: "Q3 pricing decision",
      executiveSummary: "Move to usage-based pricing for the enterprise tier.",
      sections: [
        { heading: "Situation", body: "Flat-rate pricing leaves money on the table." },
        { heading: "Recommendation", body: "Pilot usage-based with three accounts." },
      ],
      decisions: ["Pilot usage-based pricing"],
      nextActions: ["Draft the pilot terms", "Pick three accounts"],
    });
    expect(m.title).toBe("Q3 pricing decision");
    expect(m.sections).toHaveLength(2);
    expect(m.decisions).toHaveLength(1);
    expect(m.nextActions).toHaveLength(2);
  });

  it("drops sections with no body and defaults a missing heading", () => {
    const m = normalizeMemo({
      title: "T",
      executiveSummary: "S",
      sections: [{ heading: "", body: "Has body" }, { heading: "Skip", body: "" }],
    });
    expect(m.sections).toHaveLength(1);
    expect(m.sections[0].heading).toBe("Notes");
  });

  it("caps sections at 8 and lists at 10", () => {
    const m = normalizeMemo({
      title: "T",
      executiveSummary: "S",
      sections: [...Array(12).keys()].map((i) => ({ heading: `H${i}`, body: `B${i}` })),
      decisions: [...Array(15).keys()].map((i) => `Decision ${i}`),
      nextActions: [],
    });
    expect(m.sections).toHaveLength(8);
    expect(m.decisions).toHaveLength(10);
  });

  it("supplies fallbacks for a non-object payload", () => {
    const m = normalizeMemo(null);
    expect(m.title).toBe("Untitled memo");
    expect(m.executiveSummary).toBe("No summary was produced.");
    expect(m.sections).toEqual([]);
  });
});

describe("memo-dictation — renderMemoMarkdown", () => {
  it("renders a memo as markdown with headings and bullet lists", () => {
    const md = renderMemoMarkdown({
      title: "Pricing memo",
      executiveSummary: "Go usage-based.",
      sections: [{ heading: "Situation", body: "Flat rate underprices large accounts." }],
      decisions: ["Pilot usage-based pricing"],
      nextActions: ["Draft pilot terms"],
    });
    expect(md).toContain("# Pricing memo");
    expect(md).toContain("## Situation");
    expect(md).toContain("## Decisions");
    expect(md).toContain("- Pilot usage-based pricing");
    expect(md).toContain("## Next actions");
  });

  it("omits empty decision and next-action sections", () => {
    const md = renderMemoMarkdown({
      title: "T",
      executiveSummary: "S",
      sections: [],
      decisions: [],
      nextActions: [],
    });
    expect(md).not.toContain("## Decisions");
    expect(md).not.toContain("## Next actions");
  });
});
