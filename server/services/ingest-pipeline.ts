/**
 * Universal Ingest Pipeline — IMPLEMENTATION_PLAN.md Workstream 1.2 / 1.4
 *
 * Orchestrates a document from raw source to stored memory:
 *
 *   source → extractText → chunkText → extractMemoryClaims
 *          → decideExtraction → writeMemory / supersedeMemory / linkContradiction
 *
 * Every claim's decision is the unified ADD/NOOP/UPDATE/SUPERSEDE/CONTRADICTION
 * call (C23). Source trust sets initial confidence and the quarantine flag
 * (C21/C24). One failing chunk or claim never aborts the whole document — the
 * failure is recorded and ingest continues.
 */

import type { RouterContext } from "../ai/router";
import { extractText, type IngestSourceType } from "../ingest/extract-text";
import { chunkText } from "../ingest/chunking";
import { extractMemoryClaims } from "./memory-extractor";
import {
  decideExtraction,
  type ExistingCandidate,
  type IncomingClaim,
} from "../extraction/extraction-decision";
import {
  bayesianConfidence,
  DEFAULT_SOURCE_TRUST,
  shouldQuarantine,
  trustScoreForUrl,
} from "../extraction/source-trust";
import {
  writeMemory,
  supersedeMemory,
  queryMemory,
  linkContradiction,
  type WriteMemoryInput,
} from "./memory";
import { emitUsage } from "../middleware/audit";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface IngestDocumentInput {
  tenantId: string;
  companyId: number;
  projectId?: number;
  sessionId?: number;
  userId: number;
  /** text | markdown | html | url. */
  sourceType: IngestSourceType;
  /** Raw body for text/markdown/html; the URL string for `url`. */
  content: string;
  /** Provenance URL for non-url sources (sets source trust). Optional. */
  sourceUrl?: string;
  /** Safety cap on chunks processed per document. Default 25. */
  maxChunks?: number;
  traceId?: string;
}

export interface IngestDocumentResult {
  sourceType: IngestSourceType;
  resolvedUrl?: string;
  sourceChars: number;
  chunks: number;
  chunksProcessed: number;
  claimsExtracted: number;
  added: number;
  noop: number;
  updated: number;
  superseded: number;
  contradictions: number;
  quarantined: number;
  /** Trust prior applied to claims from this source. */
  sourceTrust: number;
  /** Memory items created/updated by this ingest. */
  memoryItemIds: number[];
  /** Non-fatal failures (capped). */
  errors: string[];
}

const DEFAULT_MAX_CHUNKS = 25;
const CANDIDATE_LIMIT = 8;
const MAX_ERRORS_RECORDED = 20;

// ─────────────────────────────────────────────────────────────────────────────
// PIPELINE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ingest one document into the memory subsystem.
 *
 * Resolves to a summary even on partial failure — `errors` carries anything
 * that went wrong. Throws only if the source itself cannot be read at all.
 */
export async function ingestDocument(
  input: IngestDocumentInput,
): Promise<IngestDocumentResult> {
  const ctx: RouterContext = {
    tenantId: input.tenantId,
    companyId: input.companyId,
    projectId: input.projectId,
    sessionId: input.sessionId,
    userId: input.userId,
    traceId: input.traceId,
  };

  const result: IngestDocumentResult = {
    sourceType: input.sourceType,
    sourceChars: 0,
    chunks: 0,
    chunksProcessed: 0,
    claimsExtracted: 0,
    added: 0,
    noop: 0,
    updated: 0,
    superseded: 0,
    contradictions: 0,
    quarantined: 0,
    sourceTrust: DEFAULT_SOURCE_TRUST,
    memoryItemIds: [],
    errors: [],
  };

  const recordError = (msg: string) => {
    if (result.errors.length < MAX_ERRORS_RECORDED) result.errors.push(msg);
  };

  // 1 ─ Extract text from the source.
  const extracted = await extractText(input.sourceType, input.content);
  result.sourceChars = extracted.text.length;
  result.resolvedUrl = extracted.resolvedUrl;

  // 2 ─ Source trust → initial confidence + quarantine flag (C21/C24/T12).
  const provenanceUrl = extracted.resolvedUrl ?? input.sourceUrl;
  const sourceTrust = provenanceUrl
    ? trustScoreForUrl(provenanceUrl)
    : DEFAULT_SOURCE_TRUST; // pasted content with no URL — neutral trust
  result.sourceTrust = sourceTrust;
  const quarantined = shouldQuarantine(sourceTrust, 0);
  const baseConfidence = bayesianConfidence([sourceTrust]); // single source

  // 3 ─ Chunk.
  const chunks = chunkText(extracted.text);
  result.chunks = chunks.length;
  if (chunks.length === 0) {
    recordError("Source produced no text to ingest.");
    return result;
  }
  const maxChunks = input.maxChunks ?? DEFAULT_MAX_CHUNKS;
  if (chunks.length > maxChunks) {
    recordError(
      `Document has ${chunks.length} chunks; processing the first ${maxChunks}.`,
    );
  }
  const toProcess = chunks.slice(0, maxChunks);

  // 4 ─ Per chunk: extract claims, decide, apply.
  for (const chunk of toProcess) {
    result.chunksProcessed += 1;
    const claims = await extractMemoryClaims(chunk.text, ctx);
    result.claimsExtracted += claims.length;

    for (const claim of claims) {
      try {
        await applyClaim(claim, input, ctx, { provenanceUrl, baseConfidence, quarantined }, result);
      } catch (err) {
        recordError(
          `Failed to apply claim "${claim.canonicalForm.slice(0, 60)}": ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }
  }

  // 5 ─ Usage telemetry (non-blocking).
  void emitUsage({
    tenantId: input.tenantId,
    companyId: input.companyId,
    projectId: input.projectId,
    sessionId: input.sessionId,
    userId: input.userId,
    surface: "api",
    action: "ingest-document",
    metadata: {
      sourceType: input.sourceType,
      chunks: result.chunks,
      added: result.added,
      contradictions: result.contradictions,
    },
  });

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// PER-CLAIM APPLICATION
// ─────────────────────────────────────────────────────────────────────────────

interface Provenance {
  provenanceUrl?: string;
  baseConfidence: number;
  quarantined: boolean;
}

/** Resolve one extracted claim into a memory mutation via decideExtraction. */
async function applyClaim(
  claim: import("./memory-extractor").ExtractedMemoryClaim,
  input: IngestDocumentInput,
  ctx: RouterContext,
  prov: Provenance,
  result: IngestDocumentResult,
): Promise<void> {
  // Retrieve near-neighbour candidates for the decision.
  const candidateRows = await queryMemory({
    tenantId: input.tenantId,
    companyId: input.companyId,
    projectId: input.projectId,
    query: claim.canonicalForm,
    limit: CANDIDATE_LIMIT,
    userId: input.userId,
    traceId: input.traceId,
  });
  const candidates: ExistingCandidate[] = candidateRows.map((r) => ({
    memoryItemId: r.id,
    canonicalForm: r.canonicalForm,
    rawContent: r.rawContent,
    numericClaim: null, // structured numeric is not persisted on memory_item yet
  }));

  const incoming: IncomingClaim = {
    rawContent: claim.rawContent,
    canonicalForm: claim.canonicalForm,
    numericClaim: claim.numeric,
  };
  const decision = await decideExtraction(incoming, candidates, ctx);

  const writeInput: WriteMemoryInput = {
    tenantId: input.tenantId,
    companyId: input.companyId,
    projectId: input.projectId,
    sessionId: input.sessionId,
    userId: input.userId,
    rawContent: claim.rawContent,
    canonicalForm: claim.canonicalForm,
    confidence: prov.baseConfidence,
    claimModality: claim.claimModality,
    sourceUrl: prov.provenanceUrl,
    dims: claim.dims,
    quarantined: prov.quarantined,
    traceId: input.traceId,
  };

  switch (decision.action) {
    case "add": {
      const item = await writeMemory(writeInput);
      result.added += 1;
      result.memoryItemIds.push(item.id);
      if (prov.quarantined) result.quarantined += 1;
      break;
    }

    case "noop": {
      // Duplicate of an existing item — nothing inserted.
      result.noop += 1;
      break;
    }

    case "update":
    case "supersede": {
      if (decision.targetMemoryItemId == null) {
        // Defensive: a non-ADD decision without a target is a bug upstream.
        const item = await writeMemory(writeInput);
        result.added += 1;
        result.memoryItemIds.push(item.id);
        break;
      }
      const item = await supersedeMemory(decision.targetMemoryItemId, writeInput);
      result.memoryItemIds.push(item.id);
      if (decision.action === "update") result.updated += 1;
      else result.superseded += 1;
      if (prov.quarantined) result.quarantined += 1;
      break;
    }

    case "contradiction": {
      // Store the new conflicting claim, then open a contradiction edge
      // between it and the existing item. Both remain valid (C19).
      const item = await writeMemory(writeInput);
      result.memoryItemIds.push(item.id);
      if (prov.quarantined) result.quarantined += 1;
      if (decision.targetMemoryItemId != null) {
        await linkContradiction({
          tenantId: input.tenantId,
          companyId: input.companyId,
          aId: decision.targetMemoryItemId,
          bId: item.id,
          notes: decision.reason,
        });
      }
      result.contradictions += 1;
      break;
    }
  }
}
