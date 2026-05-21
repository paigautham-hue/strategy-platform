/**
 * Unit tests — Contradiction resolution logic (server/services/contradictions.ts)
 * IMPLEMENTATION_PLAN.md Phase 2 / Workstream 2.6
 */

import { describe, it, expect } from "vitest";
import { itemRetiredBy, winnerOf } from "../services/contradictions";

const A = 101;
const B = 202;

describe("contradictions — itemRetiredBy", () => {
  it("in favor of A retires B", () => {
    expect(itemRetiredBy("resolved_in_favor_of_a", A, B)).toBe(B);
  });

  it("in favor of B retires A", () => {
    expect(itemRetiredBy("resolved_in_favor_of_b", A, B)).toBe(A);
  });

  it("both-valid-with-scope retires neither", () => {
    expect(itemRetiredBy("both_valid_with_scope", A, B)).toBeNull();
  });
});

describe("contradictions — winnerOf", () => {
  it("in favor of A makes A the winner (B is superseded by A)", () => {
    expect(winnerOf("resolved_in_favor_of_a", A, B)).toBe(A);
  });

  it("in favor of B makes B the winner", () => {
    expect(winnerOf("resolved_in_favor_of_b", A, B)).toBe(B);
  });

  it("both-valid-with-scope has no winner", () => {
    expect(winnerOf("both_valid_with_scope", A, B)).toBeNull();
  });
});

describe("contradictions — retired item and winner are never the same", () => {
  it("for in-favor resolutions, the retired item differs from the winner", () => {
    for (const r of ["resolved_in_favor_of_a", "resolved_in_favor_of_b"] as const) {
      const retired = itemRetiredBy(r, A, B);
      const winner = winnerOf(r, A, B);
      expect(retired).not.toBeNull();
      expect(winner).not.toBeNull();
      expect(retired).not.toBe(winner);
    }
  });
});
