/**
 * Unit tests — Framework Library (server/agents/frameworks.ts)
 * IMPLEMENTATION_PLAN.md Phase 3 / Workstream 3.1
 */

import { describe, it, expect } from "vitest";
import {
  FRAMEWORKS,
  getFramework,
  frameworksForQuestionType,
  normalizeFrameworkAnalysis,
} from "../agents/frameworks";
import { QUESTION_TYPES } from "../agents/diagnosis";

describe("frameworks — registry", () => {
  it("has 8 unique frameworks", () => {
    expect(FRAMEWORKS).toHaveLength(8);
    expect(new Set(FRAMEWORKS.map((f) => f.id)).size).toBe(8);
  });

  it("getFramework resolves by id", () => {
    expect(getFramework("porter_five_forces")?.label).toBe("Porter's Five Forces");
    expect(getFramework("nonexistent")).toBeUndefined();
  });
});

describe("frameworks — frameworksForQuestionType", () => {
  it("every question type selects a non-empty framework set", () => {
    for (const type of QUESTION_TYPES) {
      expect(frameworksForQuestionType(type).length).toBeGreaterThan(0);
    }
  });

  it("only returns known frameworks", () => {
    const known = new Set(FRAMEWORKS.map((f) => f.id));
    for (const type of QUESTION_TYPES) {
      for (const f of frameworksForQuestionType(type)) {
        expect(known.has(f.id)).toBe(true);
      }
    }
  });

  it("picks portfolio-appropriate frameworks for a portfolio question", () => {
    const ids = frameworksForQuestionType("portfolio").map((f) => f.id);
    expect(ids).toContain("bcg_matrix");
  });

  it("picks white-space-appropriate frameworks", () => {
    const ids = frameworksForQuestionType("white_space").map((f) => f.id);
    expect(ids).toContain("blue_ocean");
  });
});

describe("frameworks — normalizeFrameworkAnalysis", () => {
  const fw = FRAMEWORKS[0];

  it("normalizes a well-formed analysis", () => {
    const a = normalizeFrameworkAnalysis(
      {
        sections: [
          { title: "Competitive Rivalry", points: ["High — fragmented market"] },
          { title: "Threat of New Entrants", points: ["Moderate"] },
        ],
        summary: "The industry is structurally unattractive.",
        keyImplications: ["Differentiate or exit"],
      },
      fw,
    );
    expect(a.frameworkId).toBe(fw.id);
    expect(a.sections).toHaveLength(2);
    expect(a.keyImplications).toEqual(["Differentiate or exit"]);
  });

  it("drops sections with no title", () => {
    const a = normalizeFrameworkAnalysis(
      { sections: [{ points: ["orphan"] }, { title: "Real", points: ["x"] }], summary: "s" },
      fw,
    );
    expect(a.sections).toHaveLength(1);
    expect(a.sections[0].title).toBe("Real");
  });

  it("handles a non-object payload", () => {
    const a = normalizeFrameworkAnalysis(null, fw);
    expect(a.sections).toEqual([]);
    expect(a.summary).toBe("");
    expect(a.frameworkId).toBe(fw.id);
  });

  it("caps sections at 8 and points at 8", () => {
    const a = normalizeFrameworkAnalysis(
      {
        sections: Array.from({ length: 20 }, (_, i) => ({
          title: `S${i}`,
          points: Array.from({ length: 20 }, (_, j) => `p${j}`),
        })),
        summary: "s",
      },
      fw,
    );
    expect(a.sections.length).toBeLessThanOrEqual(8);
    expect(a.sections[0].points.length).toBeLessThanOrEqual(8);
  });
});
