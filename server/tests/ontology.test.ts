/**
 * Unit tests — Strategic Ontology (shared/ontology.ts)
 * IMPLEMENTATION_PLAN.md Workstream 1.1
 */

import { describe, it, expect } from "vitest";
import {
  ENTITY_TYPES,
  ENTITY_TYPE_META,
  RELATION_TYPES,
  RELATION_TYPE_META,
  isEntityType,
  isRelationType,
  entityTypeMeta,
  relationTypeMeta,
  isValidRelation,
  explainInvalidRelation,
} from "../../shared/ontology";

describe("Ontology — registries are well-formed", () => {
  it("has 15 unique entity types", () => {
    expect(ENTITY_TYPES).toHaveLength(15);
    expect(new Set(ENTITY_TYPES).size).toBe(15);
  });

  it("has 9 unique relation types", () => {
    expect(RELATION_TYPES).toHaveLength(9);
    expect(new Set(RELATION_TYPES).size).toBe(9);
  });

  it("ENTITY_TYPE_META has exactly one entry per entity type", () => {
    expect(Object.keys(ENTITY_TYPE_META).sort()).toEqual([...ENTITY_TYPES].sort());
    for (const t of ENTITY_TYPES) {
      expect(ENTITY_TYPE_META[t].type).toBe(t);
      expect(ENTITY_TYPE_META[t].label.length).toBeGreaterThan(0);
      expect(ENTITY_TYPE_META[t].description.length).toBeGreaterThan(10);
    }
  });

  it("RELATION_TYPE_META has exactly one entry per relation type", () => {
    expect(Object.keys(RELATION_TYPE_META).sort()).toEqual([...RELATION_TYPES].sort());
    for (const r of RELATION_TYPES) {
      expect(RELATION_TYPE_META[r].type).toBe(r);
      expect(RELATION_TYPE_META[r].label.length).toBeGreaterThan(0);
      expect(RELATION_TYPE_META[r].description.length).toBeGreaterThan(10);
    }
  });

  it("every relation's endpoint constraints reference only valid entity types", () => {
    for (const r of RELATION_TYPES) {
      const meta = RELATION_TYPE_META[r];
      for (const endpoint of [meta.sources, meta.targets]) {
        if (endpoint === "any") continue;
        for (const t of endpoint) {
          expect(isEntityType(t), `relation '${r}' references unknown entity type '${t}'`).toBe(
            true,
          );
        }
      }
    }
  });
});

describe("Ontology — type guards", () => {
  it("isEntityType accepts known types and rejects everything else", () => {
    expect(isEntityType("capability")).toBe(true);
    expect(isEntityType("competitor")).toBe(true);
    expect(isEntityType("technology")).toBe(false); // deliberately not a type
    expect(isEntityType("")).toBe(false);
    expect(isEntityType(null)).toBe(false);
    expect(isEntityType(42)).toBe(false);
  });

  it("isRelationType accepts known types and rejects everything else", () => {
    expect(isRelationType("operates_in")).toBe(true);
    expect(isRelationType("competes_with")).toBe(true);
    expect(isRelationType("owns")).toBe(false);
    expect(isRelationType(undefined)).toBe(false);
  });
});

describe("Ontology — metadata lookups", () => {
  it("entityTypeMeta returns the right record", () => {
    expect(entityTypeMeta("option").label).toBe("Strategic Option");
  });

  it("relationTypeMeta returns the right record", () => {
    expect(relationTypeMeta("competes_with").symmetric).toBe(true);
    expect(relationTypeMeta("operates_in").symmetric).toBe(false);
  });
});

describe("Ontology — isValidRelation", () => {
  it("accepts a valid forward edge", () => {
    // competitor operates_in market
    expect(isValidRelation("operates_in", "competitor", "market")).toBe(true);
    // supplier supplies product
    expect(isValidRelation("supplies", "supplier", "product")).toBe(true);
    // regulator regulates market
    expect(isValidRelation("regulates", "regulator", "market")).toBe(true);
  });

  it("rejects an edge whose source type is not allowed", () => {
    // person cannot operate_in a market (source must be competitor/supplier/product)
    expect(isValidRelation("operates_in", "person", "market")).toBe(false);
    // product cannot regulate (source must be regulator)
    expect(isValidRelation("regulates", "product", "market")).toBe(false);
  });

  it("rejects an edge whose target type is not allowed", () => {
    // competitor cannot operate_in a person
    expect(isValidRelation("operates_in", "competitor", "person")).toBe(false);
  });

  it("symmetric relations validate in both directions", () => {
    // competes_with is symmetric: competitor <-> competitor
    expect(isValidRelation("competes_with", "competitor", "competitor")).toBe(true);
    // adjacent_to is symmetric: market <-> product both ways
    expect(isValidRelation("adjacent_to", "market", "product")).toBe(true);
    expect(isValidRelation("adjacent_to", "product", "market")).toBe(true);
  });

  it("depends_on accepts any entity pair (constraint = 'any')", () => {
    expect(isValidRelation("depends_on", "capability", "supplier")).toBe(true);
    expect(isValidRelation("depends_on", "option", "kpi")).toBe(true);
    expect(isValidRelation("depends_on", "person", "geo")).toBe(true);
  });

  it("rejects unknown relation or entity types", () => {
    expect(isValidRelation("owns" as never, "competitor", "market")).toBe(false);
    expect(isValidRelation("operates_in", "spaceship" as never, "market")).toBe(false);
  });
});

describe("Ontology — explainInvalidRelation", () => {
  it("returns null for a valid edge", () => {
    expect(explainInvalidRelation("operates_in", "competitor", "market")).toBeNull();
  });

  it("returns a helpful message for an invalid edge", () => {
    const msg = explainInvalidRelation("operates_in", "person", "market");
    expect(msg).toBeTruthy();
    expect(msg).toContain("operates_in");
    expect(msg).toContain("person");
  });

  it("flags an unknown relation type", () => {
    const msg = explainInvalidRelation("owns" as never, "competitor", "market");
    expect(msg).toContain("not a known relation type");
  });
});
