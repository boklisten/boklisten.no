import type { HttpContext } from "@adonisjs/core/http";
import logger from "@adonisjs/core/services/logger";

import User from "#models/user";
import { LoginService } from "#services/login_service";
import { SessionRevocationService } from "#services/session_revocation_service";
import { UserService } from "#services/user_service";
import { isNorwegianMobile } from "#shared/phone_number";
import type { AuthVippsError } from "#shared/auth_vipps_error";
import { AUTH_VIPPS_ERROR } from "#shared/auth_vipps_error";
import type { VippsUser } from "#types/user";
import { clientOrigin } from "#config/app";

function redirectToAuthFailedPage(ctx: HttpContext, reason: AuthVippsError) {
  ctx.response.redirect(`${clientOrigin}/auth/failure?reason=${reason}`);
}

/**
 * The account a Vipps login belongs to: the one already linked to this Vipps identity, then the
 * one with its phone, then the one with its email, or a new one. An email Vipps has not verified
 * is anyone's to type, so it never opens an existing account. A number from outside Norway only
 * matters past the link: a linked customer who has moved abroad still logs in.
 */
async function accountOf(vippsUser: VippsUser): Promise<User | AuthVippsError> {
  const linked = await User.findBy("vippsUserId", vippsUser.id);
  if (linked) {
    return linked;
  }
  if (!isNorwegianMobile(vippsUser.phoneNumber)) {
    logger.warn("Vipps login with a phone number from outside Norway");
    return AUTH_VIPPS_ERROR.ERROR;
  }
  const byPhone = await User.byPhone(vippsUser.phoneNumber);
  if (byPhone) {
    return byPhone;
  }
  const byEmail = await User.byEmail(vippsUser.email);
  if (!byEmail) {
    return UserService.createVippsUser(vippsUser);
  }
  if (!vippsUser.emailVerified) {
    return AUTH_VIPPS_ERROR.EMAIL_IN_USE;
  }
  const claimed = !byEmail.emailConfirmed;
  if (claimed) {
    // Vipps proved the email is this person's, so whoever claimed it loses the account.
    byEmail.emailConfirmed = true;
    await SessionRevocationService.revokeAll(byEmail.id);
  }
  // No account has this number (checked above), so it may replace or fill in the stored one.
  if (claimed || byEmail.phone === null) {
    byEmail.phone = vippsUser.phoneNumber;
  }
  return byEmail;
}

export const AuthVippsService = {
  async handleCallback(ctx: HttpContext) {
    const vipps = ctx.ally.use("vipps");

    if (vipps.accessDenied()) {
      redirectToAuthFailedPage(ctx, AUTH_VIPPS_ERROR.ACCESS_DENIED);
      return;
    }
    if (vipps.stateMisMatch()) {
      redirectToAuthFailedPage(ctx, AUTH_VIPPS_ERROR.EXPIRED);
      return;
    }
    if (vipps.hasError()) {
      redirectToAuthFailedPage(ctx, AUTH_VIPPS_ERROR.ERROR);
      return;
    }

    const vippsUser = await vipps.user();

    try {
      const user = await accountOf(vippsUser);
      if (!(user instanceof User)) {
        redirectToAuthFailedPage(ctx, user);
        return;
      }
      user.vippsUserId = vippsUser.id;
      await user.save();

      await LoginService.login(ctx, user);

      // The session cookie travels with the redirect; the callback page picks up where the customer left off.
      ctx.response.redirect(`${clientOrigin}/auth/callback`);
    } catch (creationError) {
      logger.error(creationError);
      redirectToAuthFailedPage(ctx, AUTH_VIPPS_ERROR.ERROR);
    }
  },
};
