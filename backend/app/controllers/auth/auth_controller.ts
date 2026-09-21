import type { HttpContext } from "@adonisjs/core/http";
import encryption from "@adonisjs/core/services/encryption";

import UnauthorizedException from "#exceptions/unauthorized_exception";
import User from "#models/user";
import { LoginService } from "#services/login_service";
import { UserService } from "#services/user_service";
import type { User as UserDto } from "#shared/user";
import { clientOrigin } from "#config/app";

/** Purpose bound into the one-time links `mint:login-url` prints; never registered in production. */
export const DEV_LOGIN_TOKEN_PURPOSE = "dev_login";

export default class AuthController {
  /**
   * The logged-in user, or null for a guest. The frontend renders every "logged in or not"
   * decision from this one answer, on the server as well as in the browser. Wrapped in an
   * object because a bare null would be sent as an empty 204.
   */
  async me(ctx: HttpContext): Promise<{ user: UserDto | null }> {
    if (!(await ctx.auth.check())) {
      return { user: null };
    }
    await LoginService.trackActivity(ctx);
    return { user: await UserService.withTasksReconciled(ctx.auth.getUserOrFail()) };
  }

  async logout(ctx: HttpContext) {
    await ctx.auth.use().logout();
    return {};
  }

  /** Local testing only: logs in the user named by a fresh `mint:login-url` token. */
  async devLogin(ctx: HttpContext) {
    const payload = encryption.decrypt<{ userId: string }>(
      String(ctx.request.param("token")),
      DEV_LOGIN_TOKEN_PURPOSE,
    );
    if (!payload) {
      throw new UnauthorizedException("Innloggingslenken er ugyldig eller utløpt");
    }
    const user = await User.findOrFail(payload.userId);
    await LoginService.login(ctx, user);
    ctx.response.redirect(`${clientOrigin}/auth/callback`);
  }
}
