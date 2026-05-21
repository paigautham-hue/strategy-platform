/**
 * Unit tests — War-Game Simulation (server/agents/war-game.ts)
 * IMPLEMENTATION_PLAN.md Phase 3 / Workstream 3.4
 */

import { describe, it, expect } from "vitest";
import {
  STAKEHOLDERS,
  normalizeRound,
  normalizeOutcome,
} from "../agents/war-game";

describe("war-game — stakeholders", () => {
  it("has 4 distinct stakeholders across 4 arenas", () => {
    expect(STAKEHOLDERS).toHaveLength(4);
    expect(new Set(STAKEHOLDERS.map((s) => s.id)).size).toBe(4);
    expect(new Set(STAKEHOLDERS.map((s) => s.arena)).size).toBe(4);
  });
});

describe("war-game — normalizeRound", () => {
  it("normalizes a well-formed round and stamps the round number", () => {
    const r = normalizeRound(
      {
        moves: [
          { stakeholder: "competitor", move: "Cuts price 10% to defend share." },
          { stakeholder: "regulator", move: "Opens an informal inquiry." },
        ],
      },
      2,
    );
    expect(r.round).toBe(2);
    expect(r.moves).toHaveLength(2);
    expect(r.moves[0].stakeholder).toBe("competitor");
    expect(r.moves[0].stakeholderLabel).toBe("Competitor CEO");
  });

  it("defaults an unknown stakeholder to the customer", () => {
    const r = normalizeRound(
      { moves: [{ stakeholder: "alien", move: "Does something." }] },
      1,
    );
    expect(r.moves[0].stakeholder).toBe("customer");
    expect(r.moves[0].stakeholderLabel).toBe("Customer Archetype");
  });

  it("skips moves with no text and handles a non-object payload", () => {
    expect(normalizeRound(null, 1).moves).toEqual([]);
    const r = normalizeRound(
      {
        moves: [
          { stakeholder: "investor" },
          { stakeholder: "investor", move: "Builds a stake." },
        ],
      },
      1,
    );
    expect(r.moves).toHaveLength(1);
    expect(r.moves[0].move).toBe("Builds a stake.");
  });

  it("returns an empty round when moves is not an array", () => {
    const r = normalizeRound({ moves: "nope" }, 3);
    expect(r.round).toBe(3);
    expect(r.moves).toEqual([]);
  });
});

describe("war-game — normalizeOutcome", () => {
  it("normalizes a well-formed outcome", () => {
    const o = normalizeOutcome({
      outcome: "The strategy held against retaliation.",
      survived: true,
      keyLearnings: ["Move faster than the incumbent.", "Pre-clear regulators."],
    });
    expect(o.outcome).toBe("The strategy held against retaliation.");
    expect(o.survived).toBe(true);
    expect(o.keyLearnings).toHaveLength(2);
  });

  it("treats a non-boolean survived as false and supplies a fallback outcome", () => {
    const o = normalizeOutcome({ survived: "yes" });
    expect(o.survived).toBe(false);
    expect(o.outcome).toBe("The war-game produced no clear outcome.");
    expect(o.keyLearnings).toEqual([]);
  });

  it("caps key learnings at 8 and drops empty entries", () => {
    const o = normalizeOutcome({
      outcome: "x",
      survived: false,
      keyLearnings: [...Array(12).keys()].map((i) => `Learning ${i}`),
    });
    expect(o.keyLearnings).toHaveLength(8);
  });

  it("handles a non-object payload", () => {
    const o = normalizeOutcome(null);
    expect(o.survived).toBe(false);
    expect(o.keyLearnings).toEqual([]);
  });
});
