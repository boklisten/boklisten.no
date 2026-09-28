import type { HttpContext } from "@adonisjs/core/http";

import BadRequestException from "#exceptions/bad_request_exception";
import User from "#models/user";
import { UserDuplicatesService } from "#services/user_duplicates_service";
import { UserManagementService } from "#services/user_management_service";
import { UserMetricsService } from "#services/user_metrics_service";
import { userFieldsFrom, UserService } from "#services/user_service";
import { mergeUsersValidator, setPermissionValidator } from "#validators/user_management";
import { updateMeValidator, updateUserValidator, userSearchValidator } from "#validators/users";

export default class UsersController {
  /** Customers confirm their own details; saving clears the confirm-details task. */
  async updateMe(ctx: HttpContext) {
    const user = ctx.auth.getUserOrFail();
    const details = await ctx.request.validateUsing(updateMeValidator, {
      meta: { userId: user.id },
    });
    user.merge({ ...userFieldsFrom(details), taskConfirmDetails: false });
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
    await UserService.updateAsEmployee(user, {
      ...userFieldsFrom(details),
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
