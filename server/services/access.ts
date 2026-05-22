/**
 * Access Control — user roles + per-company scoping (C1)
 *
 * The platform is single-tenant, multi-company. Two access dimensions:
 *
 *   - ROLE — admin > gp > operator > portco_team. Role gates which surfaces a
 *     user sees (e.g. user management is admin-only; cost/export are GP+).
 *   - COMPANY SCOPE — `assignedCompanyIds` restricts which companies a user
 *     may see. gp/admin always see every company in the tenant. operator and
 *     portco_team are scoped to their assigned companies; an empty/null
 *     assignment means "not yet scoped" → all companies (the admin tightens
 *     this from the User Management surface).
 *
 * These functions are PURE and deterministic — exported for tests and reused
 * by the tRPC layer so the rule lives in exactly one place.
 */

import type { UserRole } from "../../drizzle/schema";

/** Roles that are never company-scoped — they see the whole tenant. */
const UNSCOPED_ROLES: readonly UserRole[] = ["gp", "admin"];

/** Only an admin may manage users (roles + company assignments). Pure. */
export function canManageUsers(role: UserRole): boolean {
  return role === "admin";
}

/**
 * Is the user's role exempt from per-company scoping? gp and admin see every
 * company in the tenant regardless of `assignedCompanyIds`. Pure.
 */
export function isUnscopedRole(role: UserRole): boolean {
  return UNSCOPED_ROLES.includes(role);
}

/**
 * Can this user access a specific company? Pure.
 *
 * - gp / admin → always.
 * - operator / portco_team → yes if `assignedCompanyIds` is null/empty
 *   (not yet scoped) or contains the company.
 */
export function canAccessCompany(
  role: UserRole,
  assignedCompanyIds: number[] | null | undefined,
  companyId: number,
): boolean {
  if (isUnscopedRole(role)) return true;
  if (!assignedCompanyIds || assignedCompanyIds.length === 0) return true;
  return assignedCompanyIds.includes(companyId);
}

/**
 * Filter a list of companies down to those the user may see. Pure — generic
 * over any object carrying a numeric `id`.
 */
export function filterAccessibleCompanies<T extends { id: number }>(
  companies: T[],
  role: UserRole,
  assignedCompanyIds: number[] | null | undefined,
): T[] {
  if (isUnscopedRole(role)) return companies;
  if (!assignedCompanyIds || assignedCompanyIds.length === 0) return companies;
  const allowed = new Set(assignedCompanyIds);
  return companies.filter((c) => allowed.has(c.id));
}
