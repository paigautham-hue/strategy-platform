/**
 * Entity Graph — IMPLEMENTATION_PLAN.md Phase 2, Workstream 2.7 (multi-hop HippoRAG)
 *
 * Single-hop retrieval finds the facts that match a query. Multi-hop retrieval
 * finds the facts that CONNECT to them — the chain "A supplies B, B serves C,
 * C competes with us" that no single memory item states.
 *
 * This module is the pure graph core: build a graph of entities and typed
 * relations, then do breadth-first multi-hop traversal and shortest-path
 * connection finding. Deterministic and fully unit-tested.
 */

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface GraphNode {
  /** Normalised id (see normalizeEntityId). */
  id: string;
  label: string;
  type: string;
}

export interface GraphEdge {
  from: string;
  to: string;
  relation: string;
}

export interface EntityGraph {
  nodes: Map<string, GraphNode>;
  /** Undirected adjacency — each edge indexed under both endpoints. */
  adjacency: Map<string, GraphEdge[]>;
}

export interface ReachResult {
  id: string;
  /** Hop distance from the nearest seed (0 = a seed itself). */
  hops: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTRUCTION
// ─────────────────────────────────────────────────────────────────────────────

/** Canonical entity id — case- and whitespace-insensitive. Pure. */
export function normalizeEntityId(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Build an entity graph from nodes and edges. Edges referencing an unknown
 * node are dropped; adjacency is undirected so traversal follows a relation in
 * either direction. Pure.
 */
export function buildEntityGraph(nodes: GraphNode[], edges: GraphEdge[]): EntityGraph {
  const nodeMap = new Map<string, GraphNode>();
  for (const n of nodes) {
    if (n.id) nodeMap.set(n.id, n);
  }
  const adjacency = new Map<string, GraphEdge[]>();
  const addAdj = (key: string, edge: GraphEdge) => {
    const list = adjacency.get(key) ?? [];
    list.push(edge);
    adjacency.set(key, list);
  };
  for (const e of edges) {
    if (e.from === e.to) continue;
    if (!nodeMap.has(e.from) || !nodeMap.has(e.to)) continue;
    addAdj(e.from, e);
    addAdj(e.to, e);
  }
  return { nodes: nodeMap, adjacency };
}

// ─────────────────────────────────────────────────────────────────────────────
// TRAVERSAL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Breadth-first multi-hop traversal. Returns every node reachable from the
 * seeds within `maxHops`, tagged with its hop distance. Pure.
 */
export function multiHopReach(
  graph: EntityGraph,
  seedIds: string[],
  maxHops: number,
): ReachResult[] {
  const visited = new Map<string, number>();
  let frontier: string[] = [];
  for (const seed of seedIds) {
    if (graph.nodes.has(seed) && !visited.has(seed)) {
      visited.set(seed, 0);
      frontier.push(seed);
    }
  }

  const hops = Math.max(0, Math.floor(maxHops));
  for (let hop = 1; hop <= hops; hop++) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const edge of graph.adjacency.get(id) ?? []) {
        const other = edge.from === id ? edge.to : edge.from;
        if (!visited.has(other)) {
          visited.set(other, hop);
          next.push(other);
        }
      }
    }
    frontier = next;
    if (frontier.length === 0) break;
  }

  return Array.from(visited.entries())
    .map(([id, h]) => ({ id, hops: h }))
    .sort((a, b) => a.hops - b.hops);
}

/**
 * The shortest connecting path (as an edge chain) between two entities, or
 * null if none exists within `maxHops`. Pure.
 */
export function shortestConnection(
  graph: EntityGraph,
  fromId: string,
  toId: string,
  maxHops: number,
): GraphEdge[] | null {
  if (!graph.nodes.has(fromId) || !graph.nodes.has(toId)) return null;
  if (fromId === toId) return [];

  const hops = Math.max(1, Math.floor(maxHops));
  const cameVia = new Map<string, GraphEdge>();
  const visited = new Set<string>([fromId]);
  let frontier: string[] = [fromId];

  for (let hop = 1; hop <= hops; hop++) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const edge of graph.adjacency.get(id) ?? []) {
        const other = edge.from === id ? edge.to : edge.from;
        if (visited.has(other)) continue;
        visited.add(other);
        cameVia.set(other, edge);
        if (other === toId) {
          // Reconstruct the path.
          const path: GraphEdge[] = [];
          let cursor = toId;
          while (cursor !== fromId) {
            const edgeIn = cameVia.get(cursor);
            if (!edgeIn) return null;
            path.unshift(edgeIn);
            cursor = edgeIn.from === cursor ? edgeIn.to : edgeIn.from;
          }
          return path;
        }
        next.push(other);
      }
    }
    frontier = next;
    if (frontier.length === 0) break;
  }
  return null;
}
