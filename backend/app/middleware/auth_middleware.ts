import type { HttpContext } from "@adonisjs/core/http";
import type { NextFn } from "@adonisjs/core/types/http";

import { PermissionService } from "#services/permission_service";
import type { UserPermission } from "#shared/user-permission";

/** The caller as identified by their access token. */
export interface AuthUser {
  detailsId: string;
  permission: UserPermission;
}

/**
 * Verifies the bearer token and, when a level is given, that the caller holds at least that
 * permission. Applied to route groups in `start/routes.ts`; controllers read the caller from
 * `ctx.authUser`.
 *
 * @throws UnauthorizedException (401) when the token is missing or invalid
 * @throws NotAllowedException (403) when the caller's permission is below the required level
 */
export default class AuthMiddleware {
  async handle(ctx: HttpContext, next: NextFn, options: { permission?: UserPermission } = {}) {
    ctx.authUser = PermissionService.authenticate(ctx, options.permission);
    return next();
  }
}

declare module "@adonisjs/core/http" {
  export interface HttpContext {
    /** Set by AuthMiddleware; only present on routes behind `middleware.auth()`. */
    authUser: AuthUser;
  }
}
