/**
 * Unit tests — Playbook Engine (server/agents/playbook.ts)
 * IMPLEMENTATION_PLAN.md Phase 6 / Workstream 6.3
 */

import { describe, it, expect } from "vitest";
import {
  normalizePlaybook,
  evidenceDiversity,
  meetsDiversityRequirement,
  outcomeHitRate,
  meetsOutcomeGate,
  nextLayer,
  checkPromotion,
  shouldRetire,
  type EvidenceProject,
} from "../agents/playbook";

const ev = (
  industry: string,
  geo: string,
  stage: string,
  succeeded: boolean,
): EvidenceProject => ({ industry, geo, stage, succeeded });

describe("playbook — normalizePlaybook", () => {
  it("normalizes a draft and orders steps, starting at the project layer", () => {
    const p = normalizePlaybook({
      title: "Land and expand",
      triggerConditions: ["Self-serve product"],
      steps: [
        { action: "Ship a free tier", gate: "Activation > 20%" },
        { action: "Add usage upsell", gate: "NRR > 110%" },
      ],
      expectedOutcomes: ["NRR above 120%"],
    });
    expect(p.layer).toBe("project");
    expect(p.steps[0].order).toBe(1);
    expect(p.steps[1].order).toBe(2);
  });

  it("drops steps with no action and defaults a missing gate", () => {
    const p = normalizePlaybook({
      title: "T",
      steps: [{ gate: "x" }, { action: "Real step" }],
    });
    expect(p.steps).toHaveLength(1);
    expect(p.steps[0].gate).toBe("—");
  });

  it("handles a non-object payload", () => {
    const p = normalizePlaybook(null);
    expect(p.title).toBe("Untitled playbook");
    expect(p.steps).toEqual([]);
  });
});

describe("playbook — diversity + outcome gates", () => {
  it("counts distinct industries, geos, stages", () => {
    const d = evidenceDiversity([
      ev("saas", "us", "seed", true),
      ev("SaaS", "eu", "series-a", false),
    ]);
    expect(d.industries).toBe(1);
    expect(d.geos).toBe(2);
    expect(d.stages).toBe(2);
  });

  it("meets the diversity requirement on any one dimension", () => {
    expect(meetsDiversityRequirement([ev("saas", "us", "seed", true)])).toBe(false);
    expect(
      meetsDiversityRequirement([
        ev("saas", "us", "seed", true),
        ev("saas", "us", "series-a", true),
      ]),
    ).toBe(true);
  });

  it("computes the outcome hit rate", () => {
    expect(
      outcomeHitRate([ev("a", "a", "a", true), ev("b", "b", "b", false)]),
    ).toBe(0.5);
    expect(outcomeHitRate([])).toBe(0);
  });

  it("meets the outcome gate only with enough successful evidence", () => {
    expect(
      meetsOutcomeGate([ev("a", "a", "a", true), ev("b", "b", "b", true)]),
    ).toBe(false); // only 2 projects
    expect(
      meetsOutcomeGate([
        ev("a", "a", "a", true),
        ev("b", "b", "b", true),
        ev("c", "c", "c", false),
      ]),
    ).toBe(true); // 3 projects, 67% hit rate
  });
});

describe("playbook — promotion ladder", () => {
  it("advances the layer and stops at portfolio", () => {
    expect(nextLayer("project")).toBe("company");
    expect(nextLayer("company")).toBe("portfolio");
    expect(nextLayer("portfolio")).toBeNull();
  });

  it("promotes project → company on the outcome gate alone", () => {
    const v = checkPromotion("project", [
      ev("saas", "us", "seed", true),
      ev("saas", "us", "seed", true),
      ev("saas", "us", "seed", true),
    ]);
    expect(v.targetLayer).toBe("company");
    expect(v.promotable).toBe(true);
  });

  it("requires diversity for company → portfolio", () => {
    const homogeneous = checkPromotion("company", [
      ev("saas", "us", "seed", true),
      ev("saas", "us", "seed", true),
      ev("saas", "us", "seed", true),
    ]);
    expect(homogeneous.promotable).toBe(false);

    const diverse = checkPromotion("company", [
      ev("saas", "us", "seed", true),
      ev("fintech", "eu", "series-a", true),
      ev("consumer", "apac", "growth", true),
    ]);
    expect(diverse.promotable).toBe(true);
  });

  it("cannot promote past the portfolio layer", () => {
    const v = checkPromotion("portfolio", []);
    expect(v.promotable).toBe(false);
    expect(v.targetLayer).toBeNull();
  });
});

describe("playbook — shouldRetire", () => {
  it("retires a stale, low-hit-rate playbook", () => {
    expect(shouldRetire(0.2, 7)).toBe(true);
    expect(shouldRetire(0.2, 3)).toBe(false); // too young
    expect(shouldRetire(0.6, 12)).toBe(false); // healthy hit rate
  });
});
