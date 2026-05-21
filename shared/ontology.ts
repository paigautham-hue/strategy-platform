/**
 * Strategic Ontology — IMPLEMENTATION_PLAN.md Workstream 1.1
 *
 * The typed vocabulary of the Strategic Knowledge Graph: what kinds of
 * entities exist and how they may relate. Pure data + helpers — no DB, no LLM.
 *
 * Used by:
 *   - the extraction pipeline, to constrain what the LLM is allowed to emit
 *   - the graph builder, to validate every edge before it is written
 *   - the UI knowledge-graph surface, to colour and label nodes/edges
 *
 * Dimensional tags (market / segment / geo / …) live on `memory_item` in
 * drizzle/schema.ts. This file is the *node + edge* vocabulary that sits
 * above those tags.
 */

// ─────────────────────────────────────────────────────────────────────────────
// ENTITY TYPES
// ─────────────────────────────────────────────────────────────────────────────

/** Every node in the Strategic Knowledge Graph has exactly one of these types. */
export const ENTITY_TYPES = [
  "capability",
  "segment",
  "product",
  "geo",
  "channel",
  "trend",
  "competitor",
  "supplier",
  "regulator",
  "signal",
  "option",
  "kpi",
  "outcome",
  "person",
  "market",
] as const;

export type EntityType = (typeof ENTITY_TYPES)[number];

export interface EntityTypeMeta {
  type: EntityType;
  label: string;
  description: string;
}

/** Human-readable metadata for each entity type. */
export const ENTITY_TYPE_META: Record<EntityType, EntityTypeMeta> = {
  capability: {
    type: "capability",
    label: "Capability",
    description:
      "Something the firm can do — a skill, asset, process, or piece of IP. The raw material of competitive advantage.",
  },
  segment: {
    type: "segment",
    label: "Customer Segment",
    description:
      "A coherent group of customers defined by need, behaviour, or firmographics (e.g. enterprise, SMB, a JTBD-based segment).",
  },
  product: {
    type: "product",
    label: "Product",
    description:
      "A product or service offering — existing, candidate, or a competitor's.",
  },
  geo: {
    type: "geo",
    label: "Geography",
    description:
      "A place: country, region, city, or regulatory zone (EU, GCC, ASEAN).",
  },
  channel: {
    type: "channel",
    label: "Channel",
    description:
      "A route to market — direct sales, PLG, channel partners, marketplace, retail.",
  },
  trend: {
    type: "trend",
    label: "Trend",
    description:
      "A directional force in the world — technological, social, economic, regulatory — that reshapes the playing field over time.",
  },
  competitor: {
    type: "competitor",
    label: "Competitor",
    description:
      "A firm that competes for the same customers, talent, capital, or suppliers.",
  },
  supplier: {
    type: "supplier",
    label: "Supplier",
    description:
      "A firm that provides inputs — goods, services, infrastructure, or capital — into the value chain.",
  },
  regulator: {
    type: "regulator",
    label: "Regulator",
    description:
      "A body whose rules constrain or enable activity in a market or geography.",
  },
  signal: {
    type: "signal",
    label: "Signal",
    description:
      "A discrete observed event — a filing, a price change, a hire, a news item — that updates belief about the world.",
  },
  option: {
    type: "option",
    label: "Strategic Option",
    description:
      "A candidate course of action the firm could take. The unit of strategic choice.",
  },
  kpi: {
    type: "kpi",
    label: "KPI",
    description:
      "A measurable indicator — leading or lagging — used to track strategy and execution.",
  },
  outcome: {
    type: "outcome",
    label: "Outcome",
    description:
      "A realised result, used to close predictions and feed the calibration loop.",
  },
  person: {
    type: "person",
    label: "Person",
    description:
      "An individual — an executive, board member, founder, or named contact.",
  },
  market: {
    type: "market",
    label: "Market",
    description:
      "An industry or sub-segment in which firms compete to serve customers.",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// RELATION TYPES
// ─────────────────────────────────────────────────────────────────────────────

/** Every edge in the Strategic Knowledge Graph has exactly one of these types. */
export const RELATION_TYPES = [
  "operates_in",
  "competes_with",
  "serves",
  "depends_on",
  "supplies",
  "regulates",
  "adjacent_to",
  "enables",
  "blocks",
] as const;

export type RelationType = (typeof RELATION_TYPES)[number];

/**
 * `"any"` means the relation accepts any entity type at that endpoint.
 * Otherwise the endpoint is constrained to the listed entity types.
 */
export type EndpointConstraint = readonly EntityType[] | "any";

export interface RelationTypeMeta {
  type: RelationType;
  label: string;
  description: string;
  /** A symmetric relation reads the same in both directions (A↔B). */
  symmetric: boolean;
  /** Entity types allowed as the edge source. */
  sources: EndpointConstraint;
  /** Entity types allowed as the edge target. */
  targets: EndpointConstraint;
}

/** Human-readable metadata + endpoint constraints for each relation type. */
export const RELATION_TYPE_META: Record<RelationType, RelationTypeMeta> = {
  operates_in: {
    type: "operates_in",
    label: "operates in",
    description: "An actor participates in a market or geography.",
    symmetric: false,
    sources: ["competitor", "supplier", "product"],
    targets: ["market", "geo"],
  },
  competes_with: {
    type: "competes_with",
    label: "competes with",
    description: "Two actors contend for the same customers, talent, or capital.",
    symmetric: true,
    sources: ["competitor", "product"],
    targets: ["competitor", "product"],
  },
  serves: {
    type: "serves",
    label: "serves",
    description: "A product or capability addresses the needs of a segment.",
    symmetric: false,
    sources: ["product", "capability", "channel"],
    targets: ["segment", "market"],
  },
  depends_on: {
    type: "depends_on",
    label: "depends on",
    description:
      "One thing requires another to function — a capability gap, a critical input, a precondition.",
    symmetric: false,
    sources: "any",
    targets: "any",
  },
  supplies: {
    type: "supplies",
    label: "supplies",
    description: "A supplier provides an input into a product or capability.",
    symmetric: false,
    sources: ["supplier"],
    targets: ["product", "capability", "competitor"],
  },
  regulates: {
    type: "regulates",
    label: "regulates",
    description: "A regulator constrains or governs a market, product, or geography.",
    symmetric: false,
    sources: ["regulator"],
    targets: ["market", "product", "geo", "channel"],
  },
  adjacent_to: {
    type: "adjacent_to",
    label: "adjacent to",
    description:
      "Two things are near-neighbours in capability, market, or product space — the basis of expansion analysis.",
    symmetric: true,
    sources: ["market", "product", "segment", "geo", "capability", "channel"],
    targets: ["market", "product", "segment", "geo", "capability", "channel"],
  },
  enables: {
    type: "enables",
    label: "enables",
    description:
      "Something makes a strategic option, capability, or product newly possible or stronger.",
    symmetric: false,
    sources: ["capability", "trend", "signal", "product"],
    targets: ["option", "capability", "product"],
  },
  blocks: {
    type: "blocks",
    label: "blocks",
    description:
      "Something prevents or weakens a strategic option or product.",
    symmetric: false,
    sources: ["regulator", "competitor", "trend", "signal"],
    targets: ["option", "product", "capability"],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Type guard: is `value` a known entity type? */
export function isEntityType(value: unknown): value is EntityType {
  return typeof value === "string" && (ENTITY_TYPES as readonly string[]).includes(value);
}

/** Type guard: is `value` a known relation type? */
export function isRelationType(value: unknown): value is RelationType {
  return typeof value === "string" && (RELATION_TYPES as readonly string[]).includes(value);
}

/** Look up entity-type metadata. Throws on an unknown type. */
export function entityTypeMeta(type: EntityType): EntityTypeMeta {
  const meta = ENTITY_TYPE_META[type];
  if (!meta) throw new Error(`Unknown entity type: ${String(type)}`);
  return meta;
}

/** Look up relation-type metadata. Throws on an unknown type. */
export function relationTypeMeta(type: RelationType): RelationTypeMeta {
  const meta = RELATION_TYPE_META[type];
  if (!meta) throw new Error(`Unknown relation type: ${String(type)}`);
  return meta;
}

/** Does an endpoint constraint admit a given entity type? */
function endpointAdmits(constraint: EndpointConstraint, type: EntityType): boolean {
  return constraint === "any" || constraint.includes(type);
}

/**
 * Validate a candidate edge against the ontology.
 *
 * For a symmetric relation, the (source, target) pair is accepted if it is
 * valid in *either* direction — A↔B reads the same both ways.
 *
 * @returns `true` if the edge is allowed by the ontology.
 */
export function isValidRelation(
  relation: RelationType,
  sourceType: EntityType,
  targetType: EntityType,
): boolean {
  if (!isRelationType(relation)) return false;
  if (!isEntityType(sourceType) || !isEntityType(targetType)) return false;

  const meta = RELATION_TYPE_META[relation];
  const forward =
    endpointAdmits(meta.sources, sourceType) && endpointAdmits(meta.targets, targetType);
  if (forward) return true;

  if (meta.symmetric) {
    return (
      endpointAdmits(meta.sources, targetType) && endpointAdmits(meta.targets, sourceType)
    );
  }
  return false;
}

/** Explain why an edge is invalid (for error messages / extraction feedback). */
export function explainInvalidRelation(
  relation: RelationType,
  sourceType: EntityType,
  targetType: EntityType,
): string | null {
  if (isValidRelation(relation, sourceType, targetType)) return null;
  if (!isRelationType(relation)) return `'${String(relation)}' is not a known relation type.`;
  if (!isEntityType(sourceType)) return `'${String(sourceType)}' is not a known entity type.`;
  if (!isEntityType(targetType)) return `'${String(targetType)}' is not a known entity type.`;
  const meta = RELATION_TYPE_META[relation];
  return (
    `Relation '${relation}' does not admit ${sourceType} → ${targetType}. ` +
    `Allowed: source ∈ ${JSON.stringify(meta.sources)}, target ∈ ${JSON.stringify(meta.targets)}` +
    (meta.symmetric ? " (symmetric)." : ".")
  );
}
