/**
 * Unit tests — Multi-Hop Entity Graph (server/retrieval/graph.ts + entity-graph.ts)
 * IMPLEMENTATION_PLAN.md Phase 2 / Workstream 2.7
 */

import { describe, it, expect } from "vitest";
import {
  normalizeEntityId,
  buildEntityGraph,
  multiHopReach,
  shortestConnection,
  type GraphNode,
  type GraphEdge,
} from "../retrieval/graph";
import { normalizeEntityExtraction } from "../services/entity-graph";

const node = (id: string): GraphNode => ({ id, label: id, type: "entity" });

describe("graph — normalizeEntityId", () => {
  it("lower-cases and collapses whitespace", () => {
    expect(normalizeEntityId("  Acme   Corp ")).toBe("acme corp");
    expect(normalizeEntityId("Acme Corp")).toBe(normalizeEntityId("acme corp"));
  });
});

describe("graph — buildEntityGraph", () => {
  it("drops edges that reference an unknown node", () => {
    const g = buildEntityGraph(
      [node("a"), node("b")],
      [
        { from: "a", to: "b", relation: "supplies" },
        { from: "a", to: "ghost", relation: "x" },
      ],
    );
    expect(g.adjacency.get("a")).toHaveLength(1);
  });
});

describe("graph — multiHopReach", () => {
  // a — b — c — d   (a chain)
  const graph = buildEntityGraph(
    [node("a"), node("b"), node("c"), node("d")],
    [
      { from: "a", to: "b", relation: "r" },
      { from: "b", to: "c", relation: "r" },
      { from: "c", to: "d", relation: "r" },
    ],
  );

  it("tags each reachable node with its hop distance", () => {
    const reached = multiHopReach(graph, ["a"], 3);
    const hops = Object.fromEntries(reached.map((r) => [r.id, r.hops]));
    expect(hops).toEqual({ a: 0, b: 1, c: 2, d: 3 });
  });

  it("respects the hop limit", () => {
    const reached = multiHopReach(graph, ["a"], 2);
    expect(reached.map((r) => r.id).sort()).toEqual(["a", "b", "c"]);
  });

  it("ignores seeds that are not in the graph", () => {
    expect(multiHopReach(graph, ["ghost"], 3)).toEqual([]);
  });
});

describe("graph — shortestConnection", () => {
  const graph = buildEntityGraph(
    [node("a"), node("b"), node("c"), node("x")],
    [
      { from: "a", to: "b", relation: "supplies" },
      { from: "b", to: "c", relation: "serves" },
    ],
  );

  it("finds the connecting edge chain between two entities", () => {
    const path = shortestConnection(graph, "a", "c", 5);
    expect(path).not.toBeNull();
    expect(path).toHaveLength(2);
    expect(path!.map((e) => e.relation)).toEqual(["supplies", "serves"]);
  });

  it("returns null when no connection exists within the hop budget", () => {
    expect(shortestConnection(graph, "a", "x", 5)).toBeNull();
    expect(shortestConnection(graph, "a", "c", 1)).toBeNull();
  });
});

describe("entity-graph — normalizeEntityExtraction", () => {
  it("normalizes entities, relations, and seed ids", () => {
    const g = normalizeEntityExtraction({
      entities: [
        { label: "Acme Corp", type: "company" },
        { label: "Beacon Health", type: "company" },
      ],
      relations: [{ from: "Acme Corp", to: "Beacon Health", relation: "supplies" }],
      queryEntities: ["Acme Corp"],
    });
    expect(g.nodes).toHaveLength(2);
    expect(g.edges).toHaveLength(1);
    expect(g.edges[0].from).toBe("acme corp");
    expect(g.seedIds).toEqual(["acme corp"]);
  });

  it("adds entities mentioned only inside a relation", () => {
    const g = normalizeEntityExtraction({
      entities: [{ label: "Acme", type: "company" }],
      relations: [{ from: "Acme", to: "Globex", relation: "competes with" }],
    });
    expect(g.nodes.map((n) => n.id).sort()).toEqual(["acme", "globex"]);
  });

  it("drops relations missing a field and handles a non-object payload", () => {
    const partial = normalizeEntityExtraction({
      entities: [{ label: "A" }],
      relations: [{ from: "A", relation: "x" }],
    });
    expect(partial.edges).toEqual([]);
    expect(normalizeEntityExtraction(null).nodes).toEqual([]);
  });
});
