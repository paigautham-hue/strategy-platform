/**
 * Unit tests — Red-Team Critic (server/agents/red-team.ts)
 * IMPLEMENTATION_PLAN.md Phase 3 / Workstream 3.3
 */

import { describe, it, expect } from "vitest";
import {
  RED_TEAM_PERSONAS,
  survivedReview,
  normalizeRedTeamReview,
  type RedTeamCritique,
} from "../agents/red-team";

const crit = (severity: RedTeamCritique["severity"]): RedTeamCritique => ({
  persona: "contrarian",
  personaLabel: "The Contrarian",
  critique: "A critique.",
  severity,
});

describe("red-team — personas", () => {
  it("has 5 distinct adversarial personas", () => {
    expect(RED_TEAM_PERSONAS).toHaveLength(5);
    expect(new Set(RED_TEAM_PERSONAS.map((p) => p.id)).size).toBe(5);
  });
});

describe("red-team — survivedReview", () => {
  it("survives when there is no fatal critique", () => {
    expect(survivedReview([crit("major"), crit("minor")])).toBe(true);
    expect(survivedReview([])).toBe(true);
  });

  it("does not survive when any critique is fatal", () => {
    expect(survivedReview([crit("minor"), crit("fatal")])).toBe(false);
  });
});

describe("red-team — normalizeRedTeamReview", () => {
  it("normalizes a well-formed review and derives the verdict flags", () => {
    const r = normalizeRedTeamReview(
      {
        critiques: [
          { persona: "regulator", critique: "Unlicensed in target market.", severity: "fatal" },
          { persona: "incumbent", critique: "Easy price-match retaliation.", severity: "major" },
        ],
        verdict: "Do not proceed without a licensing path.",
      },
      "Expand into market X",
    );
    expect(r.critiques).toHaveLength(2);
    expect(r.fatalFlaws).toEqual(["Unlicensed in target market."]);
    expect(r.survivedReview).toBe(false);
  });

  it("marks a review with no fatal critiques as survived", () => {
    const r = normalizeRedTeamReview(
      { critiques: [{ persona: "contrarian", critique: "Weak moat.", severity: "major" }], verdict: "v" },
      "S",
    );
    expect(r.survivedReview).toBe(true);
    expect(r.fatalFlaws).toEqual([]);
  });

  it("defaults an unknown severity to major", () => {
    const r = normalizeRedTeamReview(
      { critiques: [{ persona: "contrarian", critique: "x", severity: "catastrophic" }], verdict: "v" },
      "S",
    );
    expect(r.critiques[0].severity).toBe("major");
  });

  it("defaults an unknown persona to the contrarian", () => {
    const r = normalizeRedTeamReview(
      { critiques: [{ persona: "ghost", critique: "x", severity: "minor" }], verdict: "v" },
      "S",
    );
    expect(r.critiques[0].persona).toBe("contrarian");
  });

  it("skips critiques with no text and handles a non-object payload", () => {
    expect(normalizeRedTeamReview(null, "S").critiques).toEqual([]);
    const r = normalizeRedTeamReview(
      { critiques: [{ persona: "contrarian", severity: "fatal" }, { persona: "regulator", critique: "Real", severity: "minor" }], verdict: "v" },
      "S",
    );
    expect(r.critiques).toHaveLength(1);
    // the skipped one was "fatal" but had no text → not counted, so review survives
    expect(r.survivedReview).toBe(true);
  });
});
