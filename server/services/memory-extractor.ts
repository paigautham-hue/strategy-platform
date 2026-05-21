/**
 * Memory-Claim Extractor — IMPLEMENTATION_PLAN.md Workstream 1.2 / 1.4
 *
 * Turns a chunk of ingested text into structured memory claims, each already
 * in S-P-O-qualifier canonical form (C20), modality-tagged, dimensionally
 * tagged, and — when quantitative — carrying a structured NumericClaim.
 *
 * This is distinct from predictions.ts `extractClaims`, which extracts
 * forecast-style claims for the prediction ledger. This one produces the
 * shape the *memory* subsystem stores.
 *
 * The LLM call goes through the router (C3). Output is defensively parsed —
 * a malformed item is skipped, never allowed to corrupt memory.
 */

import * as router from "../ai/router";
import type { RouterContext } from "../ai/router";
import type { ClaimModality } from "../../drizzle/schema";
import {
  MAGNITUDES,
  PERIODS,
  type Magnitude,
  type NumericClaim,
  type Period,
} from "../extraction/numeric-claim";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface ExtractedMemoryClaim {
  /** Verbatim claim text. */
  rawContent: string;
  /** S-P-O-qualifier canonical form (C20). */
  canonicalForm: string;
  /** actual | hypothetical | simulated | counterfactual. */
  claimModality: ClaimModality;
  /** Dimensional tags (any subset). */
  dims: {
    market?: string;
    segment?: string;
    product?: string;
    geo?: string;
    channel?: string;
    tech?: string;
    capability?: string;
    framework?: string;
    horizon?: string;
  };
  /** Structured numeric form when the claim is quantitative. */
  numeric: NumericClaim | null;
}

const CLAIM_MODALITIES: readonly ClaimModality[] = [
  "actual",
  "hypothetical",
  "simulated",
  "counterfactual",
];

/** Max claims to keep from a single chunk — guards against runaway output. */
const MAX_CLAIMS_PER_CHUNK = 25;

// ─────────────────────────────────────────────────────────────────────────────
// LLM SCHEMA
// ─────────────────────────────────────────────────────────────────────────────

const EXTRACTION_SCHEMA = {
  name: "memory_claims",
  strict: false,
  schema: {
    type: "object",
    properties: {
      claims: {
        type: "array",
        items: {
          type: "object",
          properties: {
            rawContent: { type: "string", description: "The claim, verbatim from the text." },
            canonicalForm: {
              type: "string",
              description:
                "The claim rewritten in concise Subject-Predicate-Object-Qualifier form.",
            },
            claimModality: {
              type: "string",
              enum: ["actual", "hypothetical", "simulated", "counterfactual"],
              description: "actual = stated as fact; hypothetical = 'if'; etc.",
            },
            market: { type: "string" },
            segment: { type: "string" },
            product: { type: "string" },
            geo: { type: "string" },
            channel: { type: "string" },
            tech: { type: "string" },
            capability: { type: "string" },
            framework: { type: "string" },
            horizon: { type: "string" },
            numeric: {
              type: "object",
              description: "Present only if the claim is quantitative.",
              properties: {
                value: { type: "number" },
                unit: { type: "string", description: "Currency code, '%', or a count noun." },
                magnitude: { type: "string", enum: ["K", "M", "B", "T"] },
                period: {
                  type: "string",
                  enum: ["one_time", "daily", "weekly", "monthly", "quarterly", "annual"],
                },
                basis: { type: "string", description: "e.g. ARR, YoY, gross." },
              },
              required: ["value", "unit"],
            },
          },
          required: ["rawContent", "canonicalForm", "claimModality"],
        },
      },
    },
    required: ["claims"],
  },
} as const;

const SYSTEM_INSTRUCTION =
  "You extract atomic strategic claims from business text for a knowledge graph. " +
  "Rules: one fact per claim — split compound sentences. Skip fluff, opinions with " +
  "no content, and pure narration. For each claim, give the verbatim rawContent and a " +
  "concise S-P-O-qualifier canonicalForm. Tag dimensions (market, segment, product, " +
  "geo, channel, tech, capability, framework, horizon) only when clearly present. " +
  "If the claim is quantitative, fill the numeric object.";

// ─────────────────────────────────────────────────────────────────────────────
// RAW-OUTPUT NORMALISATION
// ─────────────────────────────────────────────────────────────────────────────

interface RawClaim {
  rawContent?: unknown;
  canonicalForm?: unknown;
  claimModality?: unknown;
  market?: unknown;
  segment?: unknown;
  product?: unknown;
  geo?: unknown;
  channel?: unknown;
  tech?: unknown;
  capability?: unknown;
  framework?: unknown;
  horizon?: unknown;
  numeric?: unknown;
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

/** Parse the optional numeric sub-object; returns null if absent or invalid. */
function parseNumeric(v: unknown): NumericClaim | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (typeof o.value !== "number" || !Number.isFinite(o.value)) return null;
  const unit = asString(o.unit);
  if (!unit) return null;

  const claim: NumericClaim = { value: o.value, unit };
  const mag = asString(o.magnitude);
  if (mag && (MAGNITUDES as readonly string[]).includes(mag)) {
    claim.magnitude = mag as Magnitude;
  }
  const period = asString(o.period);
  if (period && (PERIODS as readonly string[]).includes(period)) {
    claim.period = period as Period;
  }
  const basis = asString(o.basis);
  if (basis) claim.basis = basis;
  return claim;
}

/** Convert one raw LLM claim into an ExtractedMemoryClaim, or null if unusable. */
function normalizeClaim(raw: RawClaim): ExtractedMemoryClaim | null {
  const rawContent = asString(raw.rawContent);
  const canonicalForm = asString(raw.canonicalForm) ?? rawContent;
  if (!rawContent || !canonicalForm) return null;

  const modalityStr = asString(raw.claimModality);
  const claimModality: ClaimModality =
    modalityStr && (CLAIM_MODALITIES as readonly string[]).includes(modalityStr)
      ? (modalityStr as ClaimModality)
      : "actual";

  return {
    rawContent,
    canonicalForm,
    claimModality,
    dims: {
      market: asString(raw.market),
      segment: asString(raw.segment),
      product: asString(raw.product),
      geo: asString(raw.geo),
      channel: asString(raw.channel),
      tech: asString(raw.tech),
      capability: asString(raw.capability),
      framework: asString(raw.framework),
      horizon: asString(raw.horizon),
    },
    numeric: parseNumeric(raw.numeric),
  };
}

/**
 * Normalise a raw LLM payload into a clean claim list. Exported for testing —
 * defensive parsing is where extraction bugs hide.
 */
export function normalizeExtractionOutput(raw: unknown): ExtractedMemoryClaim[] {
  const claimsRaw =
    raw && typeof raw === "object" && Array.isArray((raw as { claims?: unknown }).claims)
      ? ((raw as { claims: unknown[] }).claims)
      : [];

  const out: ExtractedMemoryClaim[] = [];
  for (const item of claimsRaw) {
    if (!item || typeof item !== "object") continue;
    const normalized = normalizeClaim(item as RawClaim);
    if (normalized) out.push(normalized);
    if (out.length >= MAX_CLAIMS_PER_CHUNK) break;
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// EXTRACTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract structured memory claims from a chunk of text.
 *
 * Returns `[]` on any LLM/parse failure — ingest of one chunk must never
 * abort the whole document. The caller logs the empty result.
 */
export async function extractMemoryClaims(
  chunkText: string,
  ctx: RouterContext,
): Promise<ExtractedMemoryClaim[]> {
  if (!chunkText.trim()) return [];
  try {
    const result = await router.structured<{ claims: RawClaim[] }>({
      messages: [
        { role: "system", content: SYSTEM_INSTRUCTION },
        { role: "user", content: chunkText },
      ],
      schema: EXTRACTION_SCHEMA as unknown as {
        name: string;
        strict?: boolean;
        schema: Record<string, unknown>;
      },
      ctx,
    });
    return normalizeExtractionOutput(result.data);
  } catch {
    return [];
  }
}
