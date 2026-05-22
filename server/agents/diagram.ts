/**
 * Strategy Diagram Generation — IMPLEMENTATION_PLAN.md Phase 4, Workstream 4.5
 *
 * Turns a strategic subject into a STRUCTURED diagram spec — Porter's Five
 * Forces, a SWOT grid, or a Three Horizons map. The spec is rendered natively
 * in the browser (SVG / CSS), so a diagram is crisp, interactive, and costs no
 * image-generation API call.
 *
 * Stylised raster exports (Imagen / Flux, OD9) remain infra-gated — the
 * structured generation is the durable, completable core.
 */

import * as router from "../ai/router";
import type { RouterContext } from "../ai/router";
import { hybridSearchMemory } from "../services/memory-search";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type DiagramType = "porter" | "swot" | "three_horizons";

export const DIAGRAM_TYPES: readonly { type: DiagramType; label: string; description: string }[] = [
  {
    type: "porter",
    label: "Porter's Five Forces",
    description: "Industry attractiveness across the five competitive forces.",
  },
  {
    type: "swot",
    label: "SWOT",
    description: "Strengths, weaknesses, opportunities, and threats in a 2×2 grid.",
  },
  {
    type: "three_horizons",
    label: "Three Horizons",
    description: "Initiatives mapped across near, emerging, and future horizons.",
  },
] as const;

export type Intensity = "low" | "medium" | "high";

/** The five Porter forces, fixed — the model assesses each. */
export const PORTER_FORCES = [
  { id: "rivalry", label: "Competitive Rivalry" },
  { id: "new_entrants", label: "Threat of New Entrants" },
  { id: "supplier_power", label: "Supplier Power" },
  { id: "buyer_power", label: "Buyer Power" },
  { id: "substitutes", label: "Threat of Substitutes" },
] as const;

export interface PorterForce {
  id: string;
  label: string;
  intensity: Intensity;
  rationale: string;
}

export interface DiagramPorter {
  kind: "porter";
  title: string;
  forces: PorterForce[];
}

export interface DiagramSwot {
  kind: "swot";
  title: string;
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
}

export interface ThreeHorizon {
  horizon: 1 | 2 | 3;
  theme: string;
  items: string[];
}

export interface DiagramThreeHorizons {
  kind: "three_horizons";
  title: string;
  horizons: ThreeHorizon[];
}

export type DiagramData = DiagramPorter | DiagramSwot | DiagramThreeHorizons;

const MAX_LIST = 8;
const INTENSITIES: readonly Intensity[] = ["low", "medium", "high"];

// ─────────────────────────────────────────────────────────────────────────────
// PARSING HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" && v.trim() ? v.trim() : fallback;
}

function asStringList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const item of v) {
    const s = asString(item);
    if (s) out.push(s);
    if (out.length >= MAX_LIST) break;
  }
  return out;
}

function asIntensity(v: unknown): Intensity {
  const s = asString(v).toLowerCase();
  return (INTENSITIES as readonly string[]).includes(s) ? (s as Intensity) : "medium";
}

// ─────────────────────────────────────────────────────────────────────────────
// NORMALIZERS (exported for tests)
// ─────────────────────────────────────────────────────────────────────────────

/** Normalise a Porter payload — always returns all five forces. */
export function normalizePorter(raw: unknown, title: string): DiagramPorter {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const rawForces = Array.isArray(o.forces) ? o.forces : [];
  const byId = new Map<string, Record<string, unknown>>();
  for (const item of rawForces) {
    if (item && typeof item === "object") {
      const r = item as Record<string, unknown>;
      const id = asString(r.id);
      if (id) byId.set(id, r);
    }
  }
  const forces: PorterForce[] = PORTER_FORCES.map((f) => {
    const r = byId.get(f.id) ?? {};
    return {
      id: f.id,
      label: f.label,
      intensity: asIntensity(r.intensity),
      rationale: asString(r.rationale),
    };
  });
  return { kind: "porter", title, forces };
}

/** Normalise a SWOT payload. */
export function normalizeSwot(raw: unknown, title: string): DiagramSwot {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    kind: "swot",
    title,
    strengths: asStringList(o.strengths),
    weaknesses: asStringList(o.weaknesses),
    opportunities: asStringList(o.opportunities),
    threats: asStringList(o.threats),
  };
}

/** Normalise a Three Horizons payload — always returns horizons 1, 2, 3. */
export function normalizeThreeHorizons(raw: unknown, title: string): DiagramThreeHorizons {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const rawList = Array.isArray(o.horizons) ? o.horizons : [];
  const byNum = new Map<number, Record<string, unknown>>();
  for (const item of rawList) {
    if (item && typeof item === "object") {
      const r = item as Record<string, unknown>;
      const num = Number(r.horizon);
      if (num === 1 || num === 2 || num === 3) byNum.set(num, r);
    }
  }
  const horizons: ThreeHorizon[] = ([1, 2, 3] as const).map((h) => {
    const r = byNum.get(h) ?? {};
    return { horizon: h, theme: asString(r.theme), items: asStringList(r.items) };
  });
  return { kind: "three_horizons", title, horizons };
}

// ─────────────────────────────────────────────────────────────────────────────
// SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────

const PORTER_SCHEMA = {
  name: "porter_diagram",
  strict: false,
  schema: {
    type: "object",
    properties: {
      forces: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string", enum: PORTER_FORCES.map((f) => f.id) },
            intensity: { type: "string", enum: ["low", "medium", "high"] },
            rationale: { type: "string" },
          },
          required: ["id", "intensity", "rationale"],
        },
      },
    },
    required: ["forces"],
  },
} as const;

const SWOT_SCHEMA = {
  name: "swot_diagram",
  strict: false,
  schema: {
    type: "object",
    properties: {
      strengths: { type: "array", items: { type: "string" } },
      weaknesses: { type: "array", items: { type: "string" } },
      opportunities: { type: "array", items: { type: "string" } },
      threats: { type: "array", items: { type: "string" } },
    },
    required: ["strengths", "weaknesses", "opportunities", "threats"],
  },
} as const;

const THREE_HORIZONS_SCHEMA = {
  name: "three_horizons_diagram",
  strict: false,
  schema: {
    type: "object",
    properties: {
      horizons: {
        type: "array",
        items: {
          type: "object",
          properties: {
            horizon: { type: "number", enum: [1, 2, 3] },
            theme: { type: "string" },
            items: { type: "array", items: { type: "string" } },
          },
          required: ["horizon", "theme", "items"],
        },
      },
    },
    required: ["horizons"],
  },
} as const;

type Schema = { name: string; strict?: boolean; schema: Record<string, unknown> };

// ─────────────────────────────────────────────────────────────────────────────
// GENERATION
// ─────────────────────────────────────────────────────────────────────────────

const SYSTEM: Record<DiagramType, string> = {
  porter:
    "You build a Porter's Five Forces analysis. Assess each of the five forces " +
    "for the subject — intensity (low/medium/high) and a concrete one-line " +
    "rationale. Be specific to this subject, not generic.",
  swot:
    "You build a SWOT analysis. Give the genuine strengths, weaknesses, " +
    "opportunities, and threats for the subject — specific and honest, not " +
    "platitudes. A short, sharp list beats a long vague one.",
  three_horizons:
    "You build a Three Horizons map. Horizon 1 is defend-and-extend the core; " +
    "Horizon 2 is emerging growth; Horizon 3 is future options. Give each a " +
    "theme and the concrete initiatives that belong in it.",
};

/**
 * Generate a structured diagram spec for a subject, grounded in company
 * memory. Best-effort — returns an empty (but well-formed) diagram on failure.
 */
export async function generateDiagram(
  diagramType: DiagramType,
  subject: string,
  companyId: number,
  ctx: RouterContext,
): Promise<DiagramData> {
  const title = subject.trim();

  let memoryContext = "";
  try {
    const memories = await hybridSearchMemory({
      tenantId: ctx.tenantId,
      companyId,
      query: subject,
      limit: 12,
      ctx: { ...ctx, companyId },
    });
    memoryContext = memories.map((m, i) => `${i + 1}. ${m.canonicalForm}`).join("\n");
  } catch {
    memoryContext = "";
  }

  const user =
    `SUBJECT:\n${subject}\n\n` +
    (memoryContext ? `Company context:\n${memoryContext}` : "No company memory is available.");

  const schema: Schema =
    diagramType === "porter"
      ? (PORTER_SCHEMA as unknown as Schema)
      : diagramType === "swot"
        ? (SWOT_SCHEMA as unknown as Schema)
        : (THREE_HORIZONS_SCHEMA as unknown as Schema);

  try {
    const result = await router.structured<Record<string, unknown>>({
      messages: [
        { role: "system", content: SYSTEM[diagramType] },
        { role: "user", content: user },
      ],
      schema,
      ctx,
    });
    if (diagramType === "porter") return normalizePorter(result.data, title);
    if (diagramType === "swot") return normalizeSwot(result.data, title);
    return normalizeThreeHorizons(result.data, title);
  } catch {
    if (diagramType === "porter") return normalizePorter(null, title);
    if (diagramType === "swot") return normalizeSwot(null, title);
    return normalizeThreeHorizons(null, title);
  }
}
