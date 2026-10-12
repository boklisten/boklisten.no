import type { HttpContext } from "@adonisjs/core/http";
import type { NextFn } from "@adonisjs/core/types/http";

import { BranchScope } from "#services/branch_scope";

/**
 * Requires the `:branchId` of the route to be a node the logged-in user may work on: one at or
 * below their home node (`BranchScope`). Runs after `auth` and `can` on the staff route groups in
 * `start/routes.ts`; levels decide which endpoints a user reaches, this decides which rows.
 *
 * @throws NotFoundException (404) when the node is outside the caller's slice, or unknown
 */
export default class ScopeMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    await BranchScope.assertSelectable(
      ctx.auth.getUserOrFail(),
      String(ctx.request.param("branchId")),
    );
    return next();
  }
}
