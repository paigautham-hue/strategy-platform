/**
 * Unit tests — Research Mesh specialist selection (server/agents/research.ts)
 * IMPLEMENTATION_PLAN.md Phase 2 / Workstreams 2.1 + 2.3
 */

import { describe, it, expect } from "vitest";
import { specialistsForQuestionType, RESEARCH_SPECIALISTS } from "../agents/research";
import { QUESTION_TYPES } from "../agents/diagnosis";

describe("research — specialistsForQuestionType", () => {
  it("every question type selects a non-empty specialist set", () => {
    for (const type of QUESTION_TYPES) {
      const specialists = specialistsForQuestionType(type);
      expect(specialists.length).toBeGreaterThan(0);
    }
  });

  it("the internal-data analyst always runs (every question is grounded in the firm)", () => {
    for (const type of QUESTION_TYPES) {
      const ids = specialistsForQuestionType(type).map((s) => s.id);
      expect(ids).toContain("internal");
    }
  });

  it("selects geography-relevant specialists for a geographic question", () => {
    const ids = specialistsForQuestionType("geographic").map((s) => s.id);
    expect(ids).toContain("regulatory");
    expect(ids).toContain("macro");
  });

  it("selects competitor + customer for a competitive-response question", () => {
    const ids = specialistsForQuestionType("competitive_response").map((s) => s.id);
    expect(ids).toContain("competitor");
    expect(ids).toContain("customer");
  });

  it("returns only known specialists", () => {
    const knownIds = new Set(RESEARCH_SPECIALISTS.map((s) => s.id));
    for (const type of QUESTION_TYPES) {
      for (const s of specialistsForQuestionType(type)) {
        expect(knownIds.has(s.id)).toBe(true);
      }
    }
  });

  it("there are 8 specialists in the mesh", () => {
    expect(RESEARCH_SPECIALISTS).toHaveLength(8);
    expect(new Set(RESEARCH_SPECIALISTS.map((s) => s.id)).size).toBe(8);
  });
});
