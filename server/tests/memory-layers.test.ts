/**
 * Unit tests — Memory Layers (server/services/memory-layers.ts)
 * IMPLEMENTATION_PLAN.md Workstream 1.7
 *
 * Covers the pure reserved-container-name predicate. The container
 * resolution + layered retrieval (DB + embedding) run in the integration suite.
 */

import { describe, it, expect } from "vitest";
import { isReservedCompanyName } from "../services/memory-layers";

describe("memory-layers — isReservedCompanyName", () => {
  it("recognises the reserved layer containers", () => {
    expect(isReservedCompanyName("__global__")).toBe(true);
    expect(isReservedCompanyName("__user__")).toBe(true);
  });

  it("treats ordinary company names as not reserved", () => {
    expect(isReservedCompanyName("Northwind Systems")).toBe(false);
    expect(isReservedCompanyName("Acme")).toBe(false);
    expect(isReservedCompanyName("")).toBe(false);
  });

  it("requires both the leading and trailing marker", () => {
    expect(isReservedCompanyName("__global")).toBe(false);
    expect(isReservedCompanyName("global__")).toBe(false);
    expect(isReservedCompanyName("_global_")).toBe(false);
  });

  it("does not misclassify a name that merely contains underscores", () => {
    expect(isReservedCompanyName("my__company")).toBe(false);
  });
});
