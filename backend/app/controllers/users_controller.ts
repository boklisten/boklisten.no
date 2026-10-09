import type { HttpContext } from "@adonisjs/core/http";

import BadRequestException from "#exceptions/bad_request_exception";
import User from "#models/user";
import DispatchService from "#services/dispatch_service";
import { LoginService } from "#services/login_service";
import { SessionRevocationService } from "#services/session_revocation_service";
import { UserDuplicatesService } from "#services/user_duplicates_service";
import { UserManagementService } from "#services/user_management_service";
import { UserMetricsService } from "#services/user_metrics_service";
import { SMS_CODE_MESSAGES, SmsCodeService } from "#services/sms_code_service";
import {
  assertLoginDetailsEditable,
  assertMembershipAllowed,
  userFieldsFrom,
  UserService,
} from "#services/user_service";
import { mergeUsersValidator, setPermissionValidator } from "#validators/user_management";
import {
  phoneChangeCodeValidator,
  phoneChangeValidator,
  smsLoginValidator,
  updateMeValidator,
  updateUserValidator,
  userSearchValidator,
} from "#validators/users";

export default class UsersController {
  /** Customers keep their own details, email included; saving clears the confirm-details task. */
  async updateMe(ctx: HttpContext) {
    const user = ctx.auth.getUserOrFail();
    const { email, ...details } = await ctx.request.validateUsing(updateMeValidator, {
      meta: { userId: user.id },
    });
    const fields = userFieldsFrom(details);
    await assertMembershipAllowed(
      user.permission,
      user.branchMembershipId,
      fields.branchMembershipId,
    );
    await UserService.updateOwnDetails(user, { ...fields, email });
  }

  /** Sends a code to the number the logged-in user wants to log in with from now on. */
  async sendPhoneChangeCode(ctx: HttpContext) {
    const user = ctx.auth.getUserOrFail();
    const { phone } = await ctx.request.validateUsing(phoneChangeCodeValidator, {
      meta: { userId: user.id },
    });
    const refusal = await SmsCodeService.issue(
      { phone, purpose: "phone-change", userId: user.id },
      user.id,
    );
    return refusal ? { message: refusal } : {};
  }

  /** Swaps in the new number once its code proves the user holds it. */
  async changeMyPhone(ctx: HttpContext) {
    const user = ctx.auth.getUserOrFail();
    const { phone, code } = await ctx.request.validateUsing(phoneChangeValidator, {
      meta: { userId: user.id },
    });
    const check = await SmsCodeService.check(
      { phone, purpose: "phone-change", userId: user.id },
      code,
    );
    if (check !== "valid") {
      return { message: SMS_CODE_MESSAGES[check] };
    }
    const oldPhone = user.phone;
    user.phone = phone;
    await user.save();
    // In case this is a stolen session: tell the old number and log out every other device.
    if (oldPhone !== null) {
      await DispatchService.sendPhoneChangedNotice(oldPhone, user.id);
    }
    await SessionRevocationService.revokeAll(user.id);
    await LoginService.login(ctx, user);
    return {};
  }

  /** Turns SMS login on or off; off needs Vipps linked, or the user could never log in again. */
  async setSmsLogin(ctx: HttpContext) {
    const user = ctx.auth.getUserOrFail();
    const { enabled } = await ctx.request.validateUsing(smsLoginValidator);
    if (!enabled && user.vippsUserId === null) {
      throw new BadRequestException(
        "Logg inn med Vipps én gang før du slår av innlogging med SMS.",
      );
    }
    user.smsLoginEnabled = enabled;
    await user.save();
  }

  async search(ctx: HttpContext) {
    const { q } = await ctx.request.validateUsing(userSearchValidator);
    return UserService.search(q);
  }

  /** The user with both task flags brought up to date, or null when there is no such user. */
  async show(ctx: HttpContext) {
    const user = await User.find(ctx.request.param("userId"));
    return user === null ? null : UserService.withTasksReconciled(user);
  }

  async update(ctx: HttpContext) {
    const userId = ctx.request.param("userId");
    const { email, emailConfirmed, ...details } = await ctx.request.validateUsing(
      updateUserValidator,
      { meta: { userId } },
    );
    const user = await User.findOrFail(userId);
    const actor = ctx.auth.getUserOrFail();
    assertLoginDetailsEditable(actor.permission, user, { phone: details.phone, email });
    const fields = userFieldsFrom(details);
    await assertMembershipAllowed(
      actor.permission,
      user.branchMembershipId,
      fields.branchMembershipId,
    );
    await UserService.updateAsEmployee(user, {
      ...fields,
      email,
      emailConfirmed,
    });
  }

  /** For when the customer has verbally confirmed their address to an employee at the stand. */
  async confirmEmail(ctx: HttpContext) {
    const user = await User.findOrFail(ctx.request.param("userId"));
    user.emailConfirmed = true;
    await user.save();
    return { emailConfirmed: true };
  }

  async metrics() {
    return UserMetricsService.getMetrics();
  }

  async duplicates() {
    return UserDuplicatesService.findDuplicateCustomers();
  }

  async mergePreview(ctx: HttpContext) {
    const fromUserId = ctx.request.param("fromUserId");
    const toUserId = ctx.request.param("toUserId");
    const summaries = await UserDuplicatesService.summarizeUsers([fromUserId, toUserId]);
    const from = summaries.find((summary) => summary.userId === fromUserId);
    const to = summaries.find((summary) => summary.userId === toUserId);
    if (!from || !to) {
      throw new BadRequestException("Fant ikke begge kundene");
    }
    return { from, to };
  }

  async merge(ctx: HttpContext) {
    const { fromUserId, toUserId } = await ctx.request.validateUsing(mergeUsersValidator);
    await UserManagementService.mergeUsers(fromUserId, toUserId);
    return { merged: true };
  }

  async destroy(ctx: HttpContext) {
    await UserManagementService.deleteUser(ctx.request.param("userId"));
    return { deleted: true };
  }

  async employees() {
    return UserManagementService.getEmployees();
  }

  async setPermission(ctx: HttpContext) {
    const { userIds, permission } = await ctx.request.validateUsing(setPermissionValidator);
    return UserManagementService.setPermission(userIds, permission);
  }
}
