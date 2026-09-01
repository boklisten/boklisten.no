import type { HttpContext } from "@adonisjs/core/http";
import logger from "@adonisjs/core/services/logger";

import { StorageService } from "#services/storage_service";
import TokenService from "#services/token_service";
import { UserDetailService } from "#services/user_detail_service";
import { UserService } from "#services/user_service";
import type { AuthVippsError } from "#shared/auth_vipps_error";
import { AUTH_VIPPS_ERROR } from "#shared/auth_vipps_error";
import env from "#start/env";

function redirectToAuthFailedPage(ctx: HttpContext, reason: string) {
  ctx.response.redirect(`${env.get("CLIENT_URI")}/auth/failure?reason=${reason}`);
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

    let userDetail =
      (await UserDetailService.getByPhoneNumber(vippsUser.phoneNumber)) ??
      (await UserDetailService.getByEmail(vippsUser.email));
    let user = await UserService.getByUserDetailsId(userDetail?.id);

    try {
      if (!userDetail) {
        userDetail = await UserDetailService.createVippsUserDetail(vippsUser);
      }
      if (!user) {
        user = await UserService.createVippsUser(userDetail.id, vippsUser.id);
      }

      await StorageService.Users.update(user.id, {
        $set: {
          "login.vipps.userId": vippsUser.id,
          "login.vipps.lastLogin": new Date(),
        },
      });

      const tokens = await TokenService.createTokens(user);

      if (!tokens) {
        redirectToAuthFailedPage(ctx, ERROR);
        return;
      }

      ctx.response.redirect(
        `${env.get(
          "CLIENT_URI",
        )}/auth/token?access_token=${tokens.accessToken}&refresh_token=${tokens.refreshToken}`,
      );
    } catch (creationError) {
      logger.error(creationError);
      redirectToAuthFailedPage(ctx, ERROR);
    }
  },
};
