/**
 * Multi-Hop Entity Retrieval — IMPLEMENTATION_PLAN.md Phase 2, Workstream 2.7
 *
 * HippoRAG-style retrieval. A query is answered not only by the memory items
 * that match it, but by the CONNECTIONS between the entities in those items —
 * the chains a single memory item never states on its own.
 *
 * Flow: hybrid-search the query → extract entities + typed relations across
 * the retrieved items (one structured call) → build an entity graph → traverse
 * outward from the query's own entities to surface the multi-hop connections.
 */

import * as router from "../ai/router";
import type { RouterContext } from "../ai/router";
import { hybridSearchMemory } from "./memory-search";
import {
  buildEntityGraph,
  multiHopReach,
  normalizeEntityId,
  type GraphNode,
  type GraphEdge,
} from "../retrieval/graph";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface MultiHopEntity {
  label: string;
  type: string;
  /** Hop distance from the nearest query entity. */
  hops: number;
}

export interface MultiHopConnection {
  from: string;
  relation: string;
  to: string;
}

export interface MultiHopResult {
  query: string;
  entities: MultiHopEntity[];
  connections: MultiHopConnection[];
  /** How many memory items the graph was built from. */
  sourceCount: number;
}

export interface ExtractedGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** Normalised ids of the entities the query is about — the traversal seeds. */
  seedIds: string[];
}

const MAX_HOPS = 3;
const MEMORY_LIMIT = 14;

// ─────────────────────────────────────────────────────────────────────────────
// SCHEMA
// ─────────────────────────────────────────────────────────────────────────────

const EXTRACT_SCHEMA = {
  name: "entity_graph",
  strict: false,
  schema: {
    type: "object",
    properties: {
      entities: {
        type: "array",
        items: {
          type: "object",
          properties: {
            label: { type: "string" },
            type: {
              type: "string",
              description: "e.g. company, person, product, market, technology, risk.",
            },
          },
          required: ["label"],
        },
      },
      relations: {
        type: "array",
        items: {
          type: "object",
          properties: {
            from: { type: "string", description: "Source entity label." },
            to: { type: "string", description: "Target entity label." },
            relation: { type: "string", description: "How they relate — a short verb phrase." },
          },
          required: ["from", "to", "relation"],
        },
      },
      queryEntities: {
        type: "array",
        items: { type: "string" },
        description: "Labels of the entities the QUESTION is about.",
      },
    },
    required: ["entities", "relations"],
  },
} as const;

const SYSTEM_INSTRUCTION =
  "You build a knowledge graph from a set of memory items, to answer a " +
  "question that may need connecting facts across them. Extract the entities " +
  "(companies, people, products, markets, technologies, risks) and the typed " +
  "relations between them. Use a consistent label for the same entity " +
  "everywhere. Then list which entities the QUESTION itself is about.";

// ─────────────────────────────────────────────────────────────────────────────
// DEFENSIVE PARSING
// ─────────────────────────────────────────────────────────────────────────────

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" && v.trim() ? v.trim() : fallback;
}

/**
 * Normalise a raw extraction payload into graph nodes, edges, and seed ids.
 * Edges to entities that were never declared are kept only if both endpoints
 * can be resolved. Pure — exported for tests.
 */
export function normalizeEntityExtraction(raw: unknown): ExtractedGraph {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;

  const nodes = new Map<string, GraphNode>();
  const addNode = (label: string, type: string) => {
    const clean = asString(label);
    if (!clean) return;
    const id = normalizeEntityId(clean);
    if (!nodes.has(id)) nodes.set(id, { id, label: clean, type: asString(type, "entity") });
  };

  if (Array.isArray(o.entities)) {
    for (const item of o.entities) {
      if (item && typeof item === "object") {
        const r = item as Record<string, unknown>;
        addNode(asString(r.label), asString(r.type, "entity"));
      }
    }
  }

  const edges: GraphEdge[] = [];
  if (Array.isArray(o.relations)) {
    for (const item of o.relations) {
      if (!item || typeof item !== "object") continue;
      const r = item as Record<string, unknown>;
      const fromLabel = asString(r.from);
      const toLabel = asString(r.to);
      const relation = asString(r.relation);
      if (!fromLabel || !toLabel || !relation) continue;
      // An edge may mention an entity the model forgot to declare — add it.
      addNode(fromLabel, "entity");
      addNode(toLabel, "entity");
      edges.push({
        from: normalizeEntityId(fromLabel),
        to: normalizeEntityId(toLabel),
        relation,
      });
    }
  }

  const seedIds: string[] = [];
  if (Array.isArray(o.queryEntities)) {
    for (const q of o.queryEntities) {
      const id = normalizeEntityId(asString(q));
      if (id && nodes.has(id) && !seedIds.includes(id)) seedIds.push(id);
    }
  }

  return { nodes: Array.from(nodes.values()), edges, seedIds };
}

// ─────────────────────────────────────────────────────────────────────────────
// MULTI-HOP QUERY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Answer a query by multi-hop traversal of the entity graph built from the
 * memory items it retrieves. Best-effort — returns an empty result on failure.
 */
export async function multiHopQuery(
  query: string,
  companyId: number,
  ctx: RouterContext,
): Promise<MultiHopResult> {
  const empty: MultiHopResult = { query, entities: [], connections: [], sourceCount: 0 };

  let texts: string[] = [];
  try {
    const memories = await hybridSearchMemory({
      tenantId: ctx.tenantId,
      companyId,
      query,
      limit: MEMORY_LIMIT,
      ctx: { ...ctx, companyId },
    });
    texts = memories.map((m) => m.canonicalForm).filter(Boolean);
  } catch {
    texts = [];
  }
  if (texts.length === 0) return empty;

  let extracted: ExtractedGraph;
  try {
    const result = await router.structured<Record<string, unknown>>({
      messages: [
        { role: "system", content: SYSTEM_INSTRUCTION },
        {
          role: "user",
          content:
            `QUESTION:\n${query}\n\n` +
            `MEMORY ITEMS:\n${texts.map((t, i) => `${i + 1}. ${t}`).join("\n")}`,
        },
      ],
      schema: EXTRACT_SCHEMA as unknown as {
        name: string;
        strict?: boolean;
        schema: Record<string, unknown>;
      },
      ctx,
    });
    extracted = normalizeEntityExtraction(result.data);
  } catch {
    return { ...empty, sourceCount: texts.length };
  }

  const graph = buildEntityGraph(extracted.nodes, extracted.edges);

  // Seeds: the query's own entities; fall back to every entity if none matched.
  const seeds =
    extracted.seedIds.length > 0
      ? extracted.seedIds
      : extracted.nodes.map((n) => n.id);

  const reached = multiHopReach(graph, seeds, MAX_HOPS);
  const reachedIds = new Set(reached.map((r) => r.id));

  const entities: MultiHopEntity[] = reached.map((r) => {
    const node = graph.nodes.get(r.id);
    return { label: node?.label ?? r.id, type: node?.type ?? "entity", hops: r.hops };
  });

  // Connections within the reachable subgraph (de-duplicated).
  const seenEdge = new Set<string>();
  const connections: MultiHopConnection[] = [];
  for (const edge of extracted.edges) {
    if (!reachedIds.has(edge.from) || !reachedIds.has(edge.to)) continue;
    const key = `${edge.from}|${edge.relation}|${edge.to}`;
    if (seenEdge.has(key)) continue;
    seenEdge.add(key);
    connections.push({
      from: graph.nodes.get(edge.from)?.label ?? edge.from,
      relation: edge.relation,
      to: graph.nodes.get(edge.to)?.label ?? edge.to,
    });
  }

  return { query, entities, connections, sourceCount: texts.length };
}
