/**
 * Unit tests — Unified Extraction Decision (server/extraction/extraction-decision.ts)
 * IMPLEMENTATION_PLAN.md Workstream 1.4 · Critical Pattern C23
 *
 * Covers the deterministic path and LLM-output validation. The LLM call
 * itself (decideExtraction's escalation branch) is exercised in the
 * integration suite where a model is configured.
 */

import { describe, it, expect } from "vitest";
import {
  decideByDeterministicRules,
  validateLlmDecision,
  EXTRACTION_ACTIONS,
  type IncomingClaim,
  type ExistingCandidate,
} from "../extraction/extraction-decision";
import type { NumericClaim } from "../extraction/numeric-claim";

const claim = (canonicalForm: string, numericClaim?: NumericClaim): IncomingClaim => ({
  rawContent: canonicalForm,
  canonicalForm,
  numericClaim: numericClaim ?? null,
});

const candidate = (
  memoryItemId: number,
  canonicalForm: string,
  numericClaim?: NumericClaim,
): ExistingCandidate => ({
  memoryItemId,
  canonicalForm,
  rawContent: canonicalForm,
  numericClaim: numericClaim ?? null,
});

// ─── Deterministic rules ──────────────────────────────────────────────────────

describe("extraction-decision — deterministic rules", () => {
  it("no candidates → ADD", () => {
    const d = decideByDeterministicRules(claim("Acme serves the SMB segment"), []);
    expect(d).not.toBeNull();
    expect(d!.action).toBe("add");
    expect(d!.targetMemoryItemId).toBeNull();
    expect(d!.method).toBe("no-candidates");
    expect(d!.confidence).toBe(1);
  });

  it("exact canonical-form match → NOOP against that item", () => {
    const candidates = [
      candidate(10, "Beta competes with Acme"),
      candidate(11, "Acme serves the SMB segment"),
    ];
    const d = decideByDeterministicRules(claim("Acme serves the SMB segment"), candidates);
    expect(d!.action).toBe("noop");
    expect(d!.targetMemoryItemId).toBe(11);
    expect(d!.method).toBe("exact-match");
  });

  it("exact match is whitespace- and case-insensitive", () => {
    const candidates = [candidate(7, "Acme serves the SMB segment")];
    const d = decideByDeterministicRules(
      claim("  acme   SERVES the smb segment "),
      candidates,
    );
    expect(d!.action).toBe("noop");
    expect(d!.targetMemoryItemId).toBe(7);
  });

  it("numeric duplicate → NOOP", () => {
    const incoming = claim("Acme ARR is 24 million USD", {
      value: 24_000_000,
      unit: "USD",
      basis: "ARR",
    });
    const candidates = [
      candidate(20, "Acme ARR is $24M", {
        value: 24,
        unit: "USD",
        magnitude: "M",
        basis: "ARR",
      }),
    ];
    const d = decideByDeterministicRules(incoming, candidates);
    expect(d!.action).toBe("noop");
    expect(d!.targetMemoryItemId).toBe(20);
    expect(d!.method).toBe("numeric");
  });

  it("numeric contradiction → CONTRADICTION", () => {
    const incoming = claim("Acme ARR is $30M", {
      value: 30,
      unit: "USD",
      magnitude: "M",
      basis: "ARR",
    });
    const candidates = [
      candidate(21, "Acme ARR is $24M", {
        value: 24,
        unit: "USD",
        magnitude: "M",
        basis: "ARR",
      }),
    ];
    const d = decideByDeterministicRules(incoming, candidates);
    expect(d!.action).toBe("contradiction");
    expect(d!.targetMemoryItemId).toBe(21);
    expect(d!.method).toBe("numeric");
  });

  it("non-matching candidates with no numeric overlap → null (escalate to LLM)", () => {
    const candidates = [
      candidate(30, "Beta competes with Acme"),
      candidate(31, "Gamma operates in the fintech market"),
    ];
    const d = decideByDeterministicRules(claim("Acme is expanding into Brazil"), candidates);
    expect(d).toBeNull();
  });

  it("numeric claim unrelated to candidates (different unit) → null", () => {
    const incoming = claim("Acme has 500 customers", { value: 500, unit: "customers" });
    const candidates = [
      candidate(40, "Acme ARR is $24M", { value: 24, unit: "USD", magnitude: "M" }),
    ];
    expect(decideByDeterministicRules(incoming, candidates)).toBeNull();
  });
});

// ─── LLM-output validation ────────────────────────────────────────────────────

describe("extraction-decision — validateLlmDecision", () => {
  const candidates = [candidate(100, "Acme serves SMB"), candidate(101, "Acme serves enterprise")];

  it("accepts a valid ADD (candidate_index ignored)", () => {
    const d = validateLlmDecision(
      { action: "add", candidate_index: -1, reason: "genuinely new" },
      candidates,
    );
    expect(d.action).toBe("add");
    expect(d.targetMemoryItemId).toBeNull();
    expect(d.method).toBe("llm");
  });

  it("maps candidate_index to the right memoryItemId for non-ADD actions", () => {
    const d = validateLlmDecision(
      { action: "supersede", candidate_index: 1, reason: "world moved on" },
      candidates,
    );
    expect(d.action).toBe("supersede");
    expect(d.targetMemoryItemId).toBe(101);
  });

  it("rejects an unknown action", () => {
    expect(() =>
      validateLlmDecision({ action: "delete", candidate_index: 0, reason: "x" }, candidates),
    ).toThrow(/invalid action/);
  });

  it("rejects a non-ADD action with an out-of-range candidate_index", () => {
    expect(() =>
      validateLlmDecision({ action: "noop", candidate_index: 9, reason: "x" }, candidates),
    ).toThrow(/valid candidate_index/);
    expect(() =>
      validateLlmDecision({ action: "update", candidate_index: -1, reason: "x" }, candidates),
    ).toThrow(/valid candidate_index/);
  });

  it("rejects a non-object payload", () => {
    expect(() => validateLlmDecision(null, candidates)).toThrow(/non-object/);
    expect(() => validateLlmDecision("nope", candidates)).toThrow(/non-object/);
  });

  it("tolerates a missing reason", () => {
    const d = validateLlmDecision({ action: "add", candidate_index: -1 }, candidates);
    expect(d.reason).toBeTruthy();
  });

  it("EXTRACTION_ACTIONS is the closed 5-action set", () => {
    expect([...EXTRACTION_ACTIONS].sort()).toEqual(
      ["add", "contradiction", "noop", "supersede", "update"].sort(),
    );
  });
});
