import type { HttpContext } from "@adonisjs/core/http";
import type { NextFn } from "@adonisjs/core/types/http";

import { hasPermission } from "#abilities/main";
import type { UserPermission } from "#shared/user-permission";

/**
 * Requires the logged-in user to hold at least the given permission level. Runs after the `auth`
 * middleware on route groups in `start/routes.ts`.
 *
 * @throws E_AUTHORIZATION_FAILURE (403) when the caller's permission is below the level
 */
export default class CanMiddleware {
  async handle(ctx: HttpContext, next: NextFn, options: { permission: UserPermission }) {
    await ctx.bouncer.authorize(hasPermission, options.permission);
    return next();
  }
}
