/**
 * Prediction ledger service — C2, P2
 *
 * record_prediction(): called in the same DB transaction as any LLM response
 *   that emits a strategic claim. No claim ships without a ledger entry.
 * close_prediction(): records the actual outcome.
 * extract_claims(): uses router.structured to extract claims from LLM output.
 */

import { eq, and } from "drizzle-orm";
import { getDb } from "../db";
import { predictions, outcomes, type Prediction, type Outcome } from "../../drizzle/schema";
import * as router from "../ai/router";
import { appendAudit, emitUsage } from "../middleware/audit";
import type { RouterContext } from "../ai/router";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RecordPredictionInput {
  tenantId: string;
  companyId: number;
  projectId?: number;
  sessionId?: number;
  userId: number;
  claim: string;
  confidence: number;
  framework?: string;
  model: string;
  horizon?: string;
  targetDate?: Date;
  outcomeClass?: "real" | "synthetic";
  derivationDepth?: number;
  evidenceLink?: string;
  traceId?: string;
}

export interface ClosePredictionInput {
  predictionId: number;
  tenantId: string;
  companyId: number;
  actualValue: string;
  measuredAt: Date;
  source?: string;
  errorDelta?: number;
  outcomeClass?: "real" | "synthetic";
}

export interface ExtractedClaim {
  claim: string;
  confidence: number;
  framework?: string;
  horizon?: string;
}

// ─── record_prediction ────────────────────────────────────────────────────────

/**
 * Record a prediction in the ledger.
 * C2: Must be called in the same transaction as the LLM response that emits the claim.
 */
export async function recordPrediction(input: RecordPredictionInput): Promise<Prediction> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [inserted] = await db.insert(predictions).values({
    tenantId: input.tenantId,
    companyId: input.companyId,
    projectId: input.projectId,
    sessionId: input.sessionId,
    userId: input.userId,
    claim: input.claim,
    confidence: input.confidence,
    framework: input.framework,
    model: input.model,
    horizon: input.horizon,
    targetDate: input.targetDate,
    outcomeClass: input.outcomeClass ?? "real",
    derivationDepth: input.derivationDepth ?? 0,
    evidenceLink: input.evidenceLink,
  }).$returningId();

  const [row] = await db
    .select()
    .from(predictions)
    .where(eq(predictions.id, inserted.id))
    .limit(1);

  // Audit + usage (non-blocking)
  void appendAudit({
    tenantId: input.tenantId,
    companyId: input.companyId,
    projectId: input.projectId,
    sessionId: input.sessionId,
    userId: input.userId,
    action: "write",
    resourceType: "prediction",
    resourceId: String(inserted.id),
    confidentialityTier: "confidential",
    traceId: input.traceId,
  });

  return row;
}

// ─── close_prediction ─────────────────────────────────────────────────────────

export async function closePrediction(input: ClosePredictionInput): Promise<Outcome> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Verify prediction belongs to this tenant/company (C1)
  const [pred] = await db
    .select()
    .from(predictions)
    .where(
      and(
        eq(predictions.id, input.predictionId),
        eq(predictions.tenantId, input.tenantId),
        eq(predictions.companyId, input.companyId)
      )
    )
    .limit(1);

  if (!pred) {
    throw new Error(`Prediction ${input.predictionId} not found or access denied`);
  }

  const [inserted] = await db.insert(outcomes).values({
    tenantId: input.tenantId,
    companyId: input.companyId,
    predictionId: input.predictionId,
    actualValue: input.actualValue,
    measuredAt: input.measuredAt,
    source: input.source,
    errorDelta: input.errorDelta,
    outcomeClass: input.outcomeClass ?? "real",
  }).$returningId();

  // Link outcome to prediction
  await db
    .update(predictions)
    .set({ outcomeId: inserted.id })
    .where(eq(predictions.id, input.predictionId));

  const [row] = await db
    .select()
    .from(outcomes)
    .where(eq(outcomes.id, inserted.id))
    .limit(1);

  return row;
}

// ─── extract_claims ───────────────────────────────────────────────────────────

/**
 * Use router.structured to extract strategic claims from LLM output text.
 * Returns an array of claims ready to be recorded in the ledger.
 */
export async function extractClaims(
  text: string,
  ctx: RouterContext
): Promise<ExtractedClaim[]> {
  try {
    const result = await router.structured<{ claims: ExtractedClaim[] }>({
      messages: [
        {
          role: "user",
          content: `Extract all strategic claims, predictions, or assertions from the following text. For each claim, estimate a confidence score between 0 and 1, identify the strategic framework if applicable (e.g., Porter's Five Forces, SWOT, BCG Matrix), and the time horizon if mentioned.\n\nText:\n${text.slice(0, 3000)}`,
        },
      ],
      schema: {
        name: "extracted_claims",
        strict: true,
        schema: {
          type: "object",
          properties: {
            claims: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  claim: { type: "string" },
                  confidence: { type: "number" },
                  framework: { type: "string" },
                  horizon: { type: "string" },
                },
                required: ["claim", "confidence"],
                additionalProperties: false,
              },
            },
          },
          required: ["claims"],
          additionalProperties: false,
        },
      },
      ctx,
    });
    return result.data.claims ?? [];
  } catch {
    return [];
  }
}

// ─── list_predictions ─────────────────────────────────────────────────────────

export async function listPredictions(params: {
  tenantId: string;
  companyId: number;
  projectId?: number;
  limit?: number;
}): Promise<Prediction[]> {
  const db = await getDb();
  if (!db) return [];

  const conditions = [
    eq(predictions.tenantId, params.tenantId),
    eq(predictions.companyId, params.companyId),
  ];

  if (params.projectId) {
    conditions.push(eq(predictions.projectId, params.projectId));
  }

  return db
    .select()
    .from(predictions)
    .where(and(...conditions))
    .limit(params.limit ?? 20)
    .orderBy(predictions.createdAt);
}
