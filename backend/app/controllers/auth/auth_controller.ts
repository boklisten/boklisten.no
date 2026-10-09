import type { HttpContext } from "@adonisjs/core/http";

import { LoginService } from "#services/login_service";
import { UserService } from "#services/user_service";
import type { User as UserDto } from "#shared/user";

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
}
