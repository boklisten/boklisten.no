import type { HttpContext } from "@adonisjs/core/http";

import { violatedUniqueIndex } from "#models/helpers/unique_violation";
import User from "#models/user";
import { LoginService } from "#services/login_service";
import { SMS_CODE_MESSAGES, SmsCodeService } from "#services/sms_code_service";
import { UserService } from "#services/user_service";
import {
  registerValidator,
  sendLoginCodeValidator,
  verifyLoginCodeValidator,
} from "#validators/auth_validators";

/** A number a login code proved but no account has yet, kept until the sign-up form is sent. */
const VERIFIED_PHONE_KEY = "verifiedPhone";
const VERIFIED_PHONE_MS = 30 * 60 * 1000;

interface VerifiedPhone {
  phone: string;
  expiresAt: number;
}

function verifiedPhoneOf(ctx: HttpContext): string | null {
  const verified: VerifiedPhone | undefined = ctx.session.get(VERIFIED_PHONE_KEY);
  return verified && verified.expiresAt > Date.now() ? verified.phone : null;
}

export default class SmsController {
  async send(ctx: HttpContext) {
    const { phone } = await ctx.request.validateUsing(sendLoginCodeValidator);
    const user = await User.byPhone(phone);
    const refusal = await SmsCodeService.issue(
      { phone, purpose: "login", userId: null },
      user?.id ?? null,
    );
    // Says nothing about whether the number has an account: a code goes out either way.
    return refusal ? { message: refusal } : {};
  }

  /** Logs in the account with the number, or, when there is none, lets the sign-up go ahead. */
  async verify(ctx: HttpContext) {
    const { phone, code } = await ctx.request.validateUsing(verifyLoginCodeValidator);
    const user = await User.byPhone(phone);
    const check = await SmsCodeService.check({ phone, purpose: "login", userId: null }, code);
    if (check !== "valid") {
      return { message: SMS_CODE_MESSAGES[check] };
    }
    if (!user) {
      ctx.session.put(VERIFIED_PHONE_KEY, {
        phone,
        expiresAt: Date.now() + VERIFIED_PHONE_MS,
      } satisfies VerifiedPhone);
      return { signUp: true };
    }
    await LoginService.login(ctx, user);
    return { user: await UserService.withTasksReconciled(user) };
  }

  async register(ctx: HttpContext) {
    const phone = verifiedPhoneOf(ctx);
    if (!phone) {
      return { message: "Det tok for lang tid. Bekreft mobilnummeret ditt på nytt." };
    }
    const registerData = await ctx.request.validateUsing(registerValidator);
    let user;
    try {
      user = await UserService.createSmsUser(registerData, phone);
    } catch (error) {
      // Someone signed up with the number or the email after the code was checked.
      if (violatedUniqueIndex(error) !== null) {
        return {
          message: "Mobilnummeret eller e-posten har allerede en konto. Logg inn i stedet.",
        };
      }
      throw error;
    }
    ctx.session.forget(VERIFIED_PHONE_KEY);
    await LoginService.login(ctx, user);
    return { user: await UserService.withTasksReconciled(user) };
  }
}
