import type { HttpContext } from "@adonisjs/core/http";

import { BranchScope } from "#services/branch_scope";

/**
 * The customer id in the route (`:userId` unless another param is named), once the customer is
 * in the caller's scope; a customer outside it is a 404, like an unknown id (`BranchScope`).
 */
export async function customerIdInScope(ctx: HttpContext, param = "userId"): Promise<string> {
  const userId = String(ctx.request.param(param));
  await BranchScope.assertCustomerInScope(ctx.auth.getUserOrFail(), userId);
  return userId;
}
