import type { HttpContext } from "@adonisjs/core/http";
import type { NextFn } from "@adonisjs/core/types/http";

import { LoginService } from "#services/login_service";

/**
 * Requires a logged-in user (a valid session or remember-me cookie) and records their activity.
 * Applied to route groups in `start/routes.ts`; controllers read the caller with
 * `ctx.auth.getUserOrFail()`. Permission levels are checked by the `can` middleware.
 *
 * @throws E_UNAUTHORIZED_ACCESS (401) when nobody is logged in
 */
export default class AuthMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    await ctx.auth.authenticateUsing();
    await LoginService.trackActivity(ctx);
    return next();
  }
}
