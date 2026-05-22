/**
 * Unit tests — Strategy Diagram Generation (server/agents/diagram.ts)
 * IMPLEMENTATION_PLAN.md Phase 4 / Workstream 4.5
 */

import { describe, it, expect } from "vitest";
import {
  PORTER_FORCES,
  normalizePorter,
  normalizeSwot,
  normalizeThreeHorizons,
} from "../agents/diagram";

describe("diagram — normalizePorter", () => {
  it("always returns all five forces, in canonical order", () => {
    const d = normalizePorter(
      { forces: [{ id: "rivalry", intensity: "high", rationale: "Crowded market." }] },
      "Acme",
    );
    expect(d.kind).toBe("porter");
    expect(d.forces).toHaveLength(5);
    expect(d.forces.map((f) => f.id)).toEqual(PORTER_FORCES.map((f) => f.id));
    expect(d.forces[0].intensity).toBe("high");
  });

  it("defaults a missing force to medium intensity", () => {
    const d = normalizePorter({ forces: [] }, "Acme");
    expect(d.forces.every((f) => f.intensity === "medium")).toBe(true);
  });

  it("defaults an unknown intensity to medium", () => {
    const d = normalizePorter(
      { forces: [{ id: "buyer_power", intensity: "extreme", rationale: "x" }] },
      "Acme",
    );
    expect(d.forces.find((f) => f.id === "buyer_power")?.intensity).toBe("medium");
  });

  it("handles a non-object payload", () => {
    const d = normalizePorter(null, "Acme");
    expect(d.forces).toHaveLength(5);
  });
});

describe("diagram — normalizeSwot", () => {
  it("normalizes the four quadrants", () => {
    const d = normalizeSwot(
      {
        strengths: ["Brand"],
        weaknesses: ["Thin moat"],
        opportunities: ["New geo"],
        threats: ["New entrant"],
      },
      "Acme",
    );
    expect(d.kind).toBe("swot");
    expect(d.strengths).toEqual(["Brand"]);
    expect(d.threats).toEqual(["New entrant"]);
  });

  it("handles a non-object payload with empty quadrants", () => {
    const d = normalizeSwot(null, "Acme");
    expect(d.strengths).toEqual([]);
    expect(d.weaknesses).toEqual([]);
  });
});

describe("diagram — normalizeThreeHorizons", () => {
  it("always returns horizons 1, 2, and 3", () => {
    const d = normalizeThreeHorizons(
      { horizons: [{ horizon: 2, theme: "Adjacencies", items: ["New segment"] }] },
      "Acme",
    );
    expect(d.kind).toBe("three_horizons");
    expect(d.horizons.map((h) => h.horizon)).toEqual([1, 2, 3]);
    expect(d.horizons[1].theme).toBe("Adjacencies");
    expect(d.horizons[1].items).toEqual(["New segment"]);
  });

  it("handles a non-object payload", () => {
    const d = normalizeThreeHorizons(null, "Acme");
    expect(d.horizons).toHaveLength(3);
    expect(d.horizons.every((h) => h.items.length === 0)).toBe(true);
  });
});
