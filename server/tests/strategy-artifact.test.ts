/**
 * Unit tests — Strategy-Artifact Recognition (server/services/strategy-artifact.ts)
 * IMPLEMENTATION_PLAN.md Workstream 1.8
 *
 * Covers normalizeArtifactOutput — defensive parsing of recogniser output.
 * The LLM call runs in the integration suite.
 */

import { describe, it, expect } from "vitest";
import { normalizeArtifactOutput } from "../services/strategy-artifact";

describe("strategy-artifact — normalizeArtifactOutput", () => {
  it("normalizes a well-formed artifact", () => {
    const a = normalizeArtifactOutput({
      isStrategyArtifact: true,
      artifactType: "playbook",
      title: "Land and Expand",
      coreThesis: "Win a small foothold, then grow inside the account.",
      preconditions: ["Product has a low-friction entry tier", "Expansion surface exists"],
      keyMoves: ["Seed with a single team", "Instrument usage", "Trigger expansion plays"],
      expectedOutcomes: ["Net revenue retention above 120%"],
      contextOfOrigin: "B2B SaaS, 2010s",
      attribution: "Common SaaS GTM practice",
      classifierConfidence: 0.9,
    });
    expect(a.isStrategyArtifact).toBe(true);
    expect(a.artifactType).toBe("playbook");
    expect(a.title).toBe("Land and Expand");
    expect(a.preconditions).toHaveLength(2);
    expect(a.keyMoves).toHaveLength(3);
    expect(a.classifierConfidence).toBe(0.9);
  });

  it("returns a clean non-artifact result for ordinary content", () => {
    const a = normalizeArtifactOutput({ isStrategyArtifact: false });
    expect(a.isStrategyArtifact).toBe(false);
    expect(a.artifactType).toBeNull();
    expect(a.preconditions).toEqual([]);
    expect(a.keyMoves).toEqual([]);
  });

  it("nulls artifactType when not a recognised type", () => {
    const a = normalizeArtifactOutput({ isStrategyArtifact: true, artifactType: "manifesto" });
    expect(a.artifactType).toBeNull();
  });

  it("nulls artifactType when isStrategyArtifact is false even if a type is given", () => {
    const a = normalizeArtifactOutput({ isStrategyArtifact: false, artifactType: "framework" });
    expect(a.artifactType).toBeNull();
  });

  it("handles a non-object payload", () => {
    expect(normalizeArtifactOutput(null).isStrategyArtifact).toBe(false);
    expect(normalizeArtifactOutput("nope").isStrategyArtifact).toBe(false);
    expect(normalizeArtifactOutput(undefined).keyMoves).toEqual([]);
  });

  it("filters non-string and empty items out of list fields", () => {
    const a = normalizeArtifactOutput({
      isStrategyArtifact: true,
      artifactType: "framework",
      keyMoves: ["Real move", "", "  ", 42, null, "Another move"],
    });
    expect(a.keyMoves).toEqual(["Real move", "Another move"]);
  });

  it("caps list fields at 15 items", () => {
    const a = normalizeArtifactOutput({
      isStrategyArtifact: true,
      artifactType: "framework",
      preconditions: Array.from({ length: 40 }, (_, i) => `precondition ${i}`),
    });
    expect(a.preconditions).toHaveLength(15);
  });

  it("clamps classifierConfidence into [0,1] and defaults sensibly", () => {
    expect(normalizeArtifactOutput({ isStrategyArtifact: true, classifierConfidence: 2 }).classifierConfidence).toBe(1);
    expect(normalizeArtifactOutput({ isStrategyArtifact: true, classifierConfidence: -1 }).classifierConfidence).toBe(0);
    expect(normalizeArtifactOutput({ isStrategyArtifact: true }).classifierConfidence).toBe(0.5);
  });

  it("defaults a missing title", () => {
    expect(normalizeArtifactOutput({ isStrategyArtifact: true }).title).toBe("(untitled)");
  });
});
