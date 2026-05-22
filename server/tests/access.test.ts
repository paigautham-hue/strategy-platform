/**
 * Unit tests — Access Control (server/services/access.ts)
 * Roles + per-company scoping (C1)
 */

import { describe, it, expect } from "vitest";
import {
  canManageUsers,
  isUnscopedRole,
  canAccessCompany,
  filterAccessibleCompanies,
} from "../services/access";

describe("access — canManageUsers", () => {
  it("allows only admins to manage users", () => {
    expect(canManageUsers("admin")).toBe(true);
    expect(canManageUsers("gp")).toBe(false);
    expect(canManageUsers("operator")).toBe(false);
    expect(canManageUsers("portco_team")).toBe(false);
  });
});

describe("access — isUnscopedRole", () => {
  it("treats gp and admin as unscoped", () => {
    expect(isUnscopedRole("gp")).toBe(true);
    expect(isUnscopedRole("admin")).toBe(true);
    expect(isUnscopedRole("operator")).toBe(false);
    expect(isUnscopedRole("portco_team")).toBe(false);
  });
});

describe("access — canAccessCompany", () => {
  it("lets gp and admin access any company", () => {
    expect(canAccessCompany("gp", [1], 99)).toBe(true);
    expect(canAccessCompany("admin", null, 99)).toBe(true);
  });

  it("lets a scoped user access only assigned companies", () => {
    expect(canAccessCompany("operator", [1, 2], 2)).toBe(true);
    expect(canAccessCompany("operator", [1, 2], 3)).toBe(false);
    expect(canAccessCompany("portco_team", [5], 5)).toBe(true);
    expect(canAccessCompany("portco_team", [5], 6)).toBe(false);
  });

  it("treats a null/empty assignment as not-yet-scoped (sees all)", () => {
    expect(canAccessCompany("operator", null, 7)).toBe(true);
    expect(canAccessCompany("portco_team", [], 7)).toBe(true);
  });
});

describe("access — filterAccessibleCompanies", () => {
  const companies = [{ id: 1 }, { id: 2 }, { id: 3 }];

  it("returns every company for gp and admin", () => {
    expect(filterAccessibleCompanies(companies, "gp", [1])).toHaveLength(3);
    expect(filterAccessibleCompanies(companies, "admin", null)).toHaveLength(3);
  });

  it("filters to the assignment for a scoped user", () => {
    const visible = filterAccessibleCompanies(companies, "operator", [1, 3]);
    expect(visible.map((c) => c.id)).toEqual([1, 3]);
  });

  it("returns all companies when a scoped user has no assignment", () => {
    expect(filterAccessibleCompanies(companies, "portco_team", null)).toHaveLength(3);
    expect(filterAccessibleCompanies(companies, "portco_team", [])).toHaveLength(3);
  });
});
