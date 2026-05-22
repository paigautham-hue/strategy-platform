/**
 * Unit tests — Confounder DAGs (server/causal/confounder-dags.ts)
 * IMPLEMENTATION_PLAN.md Phase 6 / Workstream 6.6
 */

import { describe, it, expect } from "vitest";
import {
  CONFOUNDER_DAGS,
  listConfounderIndustries,
  getConfounderDag,
  renderConfounders,
  isAcyclic,
} from "../causal/confounder-dags";

describe("confounder-dags — data integrity", () => {
  it("every curated graph is a genuine DAG (acyclic)", () => {
    for (const dag of CONFOUNDER_DAGS) {
      expect(isAcyclic(dag)).toBe(true);
    }
  });

  it("every edge references nodes that exist in the same DAG", () => {
    for (const dag of CONFOUNDER_DAGS) {
      const ids = new Set(dag.nodes.map((n) => n.id));
      for (const edge of dag.edges) {
        expect(ids.has(edge.from)).toBe(true);
        expect(ids.has(edge.to)).toBe(true);
      }
    }
  });

  it("includes a generic fallback DAG", () => {
    expect(CONFOUNDER_DAGS.some((d) => d.industry === "generic")).toBe(true);
    expect(listConfounderIndustries().length).toBe(CONFOUNDER_DAGS.length);
  });
});

describe("confounder-dags — getConfounderDag", () => {
  it("matches a direct industry key", () => {
    expect(getConfounderDag("fintech").industry).toBe("fintech");
  });

  it("matches free-text industry phrasings by keyword", () => {
    expect(getConfounderDag("Enterprise SaaS").industry).toBe("b2b_saas");
    expect(getConfounderDag("financial services / lending").industry).toBe("fintech");
    expect(getConfounderDag("D2C consumer brand").industry).toBe("consumer");
    expect(getConfounderDag("a two-sided marketplace").industry).toBe("marketplace");
    expect(getConfounderDag("digital health").industry).toBe("healthcare");
  });

  it("falls back to the generic DAG for an unknown or empty industry", () => {
    expect(getConfounderDag("artisanal widgets").industry).toBe("generic");
    expect(getConfounderDag("").industry).toBe("generic");
    expect(getConfounderDag(null).industry).toBe("generic");
    expect(getConfounderDag(undefined).industry).toBe("generic");
  });
});

describe("confounder-dags — renderConfounders", () => {
  it("renders node labels and the influence edges", () => {
    const text = renderConfounders(getConfounderDag("b2b_saas"));
    expect(text).toContain("Macro interest rates");
    expect(text).toContain("Known confounders for the B2B SaaS industry");
    expect(text).toContain("influences");
  });
});

describe("confounder-dags — isAcyclic", () => {
  it("detects a cycle when one is introduced", () => {
    const cyclic = {
      industry: "x",
      label: "X",
      nodes: [
        { id: "a", label: "A", description: "" },
        { id: "b", label: "B", description: "" },
      ],
      edges: [
        { from: "a", to: "b" },
        { from: "b", to: "a" },
      ],
    };
    expect(isAcyclic(cyclic)).toBe(false);
  });

  it("accepts a simple acyclic chain", () => {
    const acyclic = {
      industry: "x",
      label: "X",
      nodes: [
        { id: "a", label: "A", description: "" },
        { id: "b", label: "B", description: "" },
        { id: "c", label: "C", description: "" },
      ],
      edges: [
        { from: "a", to: "b" },
        { from: "b", to: "c" },
      ],
    };
    expect(isAcyclic(acyclic)).toBe(true);
  });
});
