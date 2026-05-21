/**
 * Unit tests — Persona Registry + Consult (server/agents/personas.ts)
 * IMPLEMENTATION_PLAN.md Phase 4 / Workstream 4.4
 */

import { describe, it, expect } from "vitest";
import {
  PERSONAS,
  getPersona,
  listPersonas,
  normalizeConsult,
} from "../agents/personas";

describe("personas — registry", () => {
  it("has 5 distinct personas", () => {
    expect(PERSONAS).toHaveLength(5);
    expect(new Set(PERSONAS.map((p) => p.id)).size).toBe(5);
  });

  it("getPersona resolves a known id and defaults to the coach", () => {
    expect(getPersona("challenger").label).toBe("The Challenger");
    expect(getPersona("nobody").id).toBe("coach");
  });

  it("listPersonas exposes id/label/description but not the stance prompt", () => {
    const list = listPersonas();
    expect(list).toHaveLength(5);
    for (const p of list) {
      expect(Object.keys(p).sort()).toEqual(["description", "id", "label"]);
    }
  });
});

describe("personas — normalizeConsult", () => {
  it("normalizes a well-formed consult and stamps the persona", () => {
    const c = normalizeConsult(
      { response: "Push harder on the moat.", keyPoints: ["Moat is weak", "Test pricing"] },
      getPersona("challenger"),
    );
    expect(c.personaId).toBe("challenger");
    expect(c.personaLabel).toBe("The Challenger");
    expect(c.response).toContain("moat");
    expect(c.keyPoints).toHaveLength(2);
  });

  it("caps key points at 6 and drops empty ones", () => {
    const c = normalizeConsult(
      {
        response: "x",
        keyPoints: ["a", "", "  ", ...[...Array(10).keys()].map((i) => `point ${i}`)],
      },
      getPersona("coach"),
    );
    expect(c.keyPoints).toHaveLength(6);
  });

  it("supplies a fallback for a non-object payload", () => {
    const c = normalizeConsult(null, getPersona("consultant"));
    expect(c.response).toBe("The persona produced no response.");
    expect(c.keyPoints).toEqual([]);
    expect(c.personaId).toBe("consultant");
  });
});
