import type { HttpContext } from "@adonisjs/core/http";
import logger from "@adonisjs/core/services/logger";

import User from "#models/user";
import { LoginService } from "#services/login_service";
import { SessionRevocationService } from "#services/session_revocation_service";
import { UserService } from "#services/user_service";
import type { PendingVippsLogin } from "#services/vipps/vipps_login_client";
import { VippsLoginClient } from "#services/vipps/vipps_login_client";
import { isNorwegianMobile } from "#shared/phone_number";
import type { AuthVippsError } from "#shared/auth_vipps_error";
import { AUTH_VIPPS_ERROR } from "#shared/auth_vipps_error";
import type { VippsUser } from "#types/user";
import { clientOrigin, cookieEnvironmentSuffix } from "#config/app";

/** Staging and production share the cookie domain, hence the suffix. */
const LOGIN_COOKIE_NAME = `vipps_login${cookieEnvironmentSuffix}`;

/** What the callback must prove, and the page the login started from. */
interface VippsLoginCookie extends PendingVippsLogin {
  target: string;
}

/** The callback `error` codes the failure page explains on their own. */
const FAILURE_REASONS: Partial<Record<string, AuthVippsError>> = {
  access_denied: AUTH_VIPPS_ERROR.ACCESS_DENIED,
  outdated_app_version: AUTH_VIPPS_ERROR.OUTDATED_APP_VERSION,
  wrong_challenge: AUTH_VIPPS_ERROR.WRONG_CHALLENGE,
};

function redirectToAuthFailedPage(ctx: HttpContext, reason: AuthVippsError) {
  ctx.response.redirect(`${clientOrigin}/auth/failure?reason=${reason}`);
}

/**
 * A page on the site in the frontend's `redirect` spelling (no leading slash), or "" (the front
 * page) for anything that would leave the site once the frontend prefixes its own slash.
 */
export function loginTargetOf(raw: unknown): string {
  if (typeof raw !== "string") {
    return "";
  }
  try {
    const url = new URL(`/${raw}`, clientOrigin);
    const target = `${url.pathname}${url.search}${url.hash}`.slice(1);
    return url.origin === clientOrigin && !target.startsWith("/") ? target : "";
  } catch {
    return "";
  }
}

/** The target itself, or the pending-tasks page first with the target carried along. */
function destinationAfterLogin(target: string, hasPendingTasks: boolean): string {
  if (!hasPendingTasks) {
    return `${clientOrigin}/${target}`;
  }
  return target
    ? `${clientOrigin}/oppgaver?redirect=${encodeURIComponent(target)}`
    : `${clientOrigin}/oppgaver`;
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
  /** Sends the browser to Vipps, remembering where to land once Vipps sends it back. */
  async startLogin(ctx: HttpContext) {
    const { url, pending } = await VippsLoginClient.start();
    const login: VippsLoginCookie = {
      ...pending,
      target: loginTargetOf(ctx.request.input("redirect")),
    };
    // SameSite=Lax (the app-wide default) survives Vipps' top-level GET back to the callback.
    ctx.response.encryptedCookie(LOGIN_COOKIE_NAME, login, { maxAge: "1h" });
    ctx.response.redirect(url);
  },

  async handleCallback(ctx: HttpContext) {
    // Encrypted with the app key, so a cookie that decrypts is one `startLogin` wrote.
    const login: VippsLoginCookie | undefined = ctx.request.encryptedCookie(LOGIN_COOKIE_NAME);
    ctx.response.clearCookie(LOGIN_COOKIE_NAME);

    const vippsError: unknown = ctx.request.input("error");
    if (vippsError !== undefined) {
      const reason =
        (typeof vippsError === "string" ? FAILURE_REASONS[vippsError] : undefined) ??
        AUTH_VIPPS_ERROR.ERROR;
      if (reason !== AUTH_VIPPS_ERROR.ACCESS_DENIED) {
        // Vipps adds codes without notice; the log is where a new one shows up.
        logger.warn(
          { error: vippsError, description: ctx.request.input("error_description") },
          "Vipps login came back with an error",
        );
      }
      redirectToAuthFailedPage(ctx, reason);
      return;
    }
    if (!login || ctx.request.input("state") !== login.state) {
      redirectToAuthFailedPage(ctx, AUTH_VIPPS_ERROR.EXPIRED);
      return;
    }

    try {
      const vippsUser = await VippsLoginClient.finish(ctx.request.parsedUrl.query, login);
      const user = await accountOf(vippsUser);
      if (!(user instanceof User)) {
        redirectToAuthFailedPage(ctx, user);
        return;
      }
      user.vippsUserId = vippsUser.id;
      await user.save();

      await LoginService.login(ctx, user);

      // The session cookie travels with the redirect, so the page renders logged in right away.
      const tasks = await UserService.withTasksReconciled(user);
      ctx.response.redirect(
        destinationAfterLogin(login.target, tasks.taskConfirmDetails || tasks.taskSignAgreement),
      );
    } catch (error) {
      logger.error(error);
      redirectToAuthFailedPage(ctx, AUTH_VIPPS_ERROR.ERROR);
    }
  },
};
