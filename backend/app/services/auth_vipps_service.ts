import type { HttpContext } from "@adonisjs/core/http";
import logger from "@adonisjs/core/services/logger";

import User from "#models/user";
import { LoginService } from "#services/login_service";
import { UserService } from "#services/user_service";
import type { AuthVippsError } from "#shared/auth_vipps_error";
import { AUTH_VIPPS_ERROR } from "#shared/auth_vipps_error";
import { clientOrigin } from "#config/app";

function redirectToAuthFailedPage(ctx: HttpContext, reason: string) {
  ctx.response.redirect(`${clientOrigin}/auth/failure?reason=${reason}`);
}

export const AuthVippsService = {
  async handleCallback(ctx: HttpContext) {
    const vipps = ctx.ally.use("vipps");

    let error: AuthVippsError | null = null;
    const { ACCESS_DENIED, EXPIRED, ERROR } = AUTH_VIPPS_ERROR;

    if (vipps.accessDenied()) {
      error = ACCESS_DENIED;
    } else if (vipps.stateMisMatch()) {
      error = EXPIRED;
    } else if (vipps.hasError()) {
      error = ERROR;
    }

    if (error) {
      redirectToAuthFailedPage(ctx, error);
      return;
    }

    const vippsUser = await vipps.user();

    try {
      // The account is found by phone or email, so a Vipps identity moves along with the phone
      // number; the unique index on the Vipps id means the previous holder loses it first.
      const user =
        (await User.byPhone(vippsUser.phoneNumber)) ??
        (await User.byEmail(vippsUser.email)) ??
        (await UserService.createVippsUser(vippsUser));
      if (user.vippsUserId !== vippsUser.id) {
        await User.query()
          .where("vippsUserId", vippsUser.id)
          .whereNot("id", user.id)
          .update({ vippsUserId: null });
      }
      user.vippsUserId = vippsUser.id;
      await user.save();

      await LoginService.login(ctx, user);

      // The session cookie travels with the redirect; the callback page picks up where the customer left off.
      ctx.response.redirect(`${clientOrigin}/auth/callback`);
    } catch (creationError) {
      logger.error(creationError);
      redirectToAuthFailedPage(ctx, ERROR);
    }
  },
};
