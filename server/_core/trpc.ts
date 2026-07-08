import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { canAccessCompany } from "../services/access";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

/**
 * C1 company scoping enforced at the transport boundary: any procedure whose
 * input carries a numeric `companyId` is checked against the caller's role +
 * `assignedCompanyIds` BEFORE the resolver runs. gp/admin pass everywhere;
 * a scoped operator/portco_team gets FORBIDDEN outside their assignment.
 * Resolvers may still do finer checks (existence, cross-company arrays) —
 * this middleware guarantees the baseline can never be forgotten again.
 */
const enforceCompanyScope = t.middleware(async opts => {
  const { ctx, next } = opts;
  if (ctx.user) {
    const rawInput = await opts.getRawInput();
    if (
      rawInput !== null &&
      typeof rawInput === "object" &&
      "companyId" in rawInput &&
      typeof (rawInput as { companyId: unknown }).companyId === "number"
    ) {
      const companyId = (rawInput as { companyId: number }).companyId;
      const allowed = canAccessCompany(
        ctx.user.role,
        (ctx.user as { assignedCompanyIds?: number[] | null }).assignedCompanyIds ?? null,
        companyId,
      );
      if (!allowed) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have access to this company.",
        });
      }
    }
  }
  return next();
});

export const protectedProcedure = t.procedure.use(requireUser).use(enforceCompanyScope);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);
