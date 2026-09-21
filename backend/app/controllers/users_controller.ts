import type { HttpContext } from "@adonisjs/core/http";

import BadRequestException from "#exceptions/bad_request_exception";
import User from "#models/user";
import { UserDuplicatesService } from "#services/user_duplicates_service";
import { UserManagementService } from "#services/user_management_service";
import { UserMetricsService } from "#services/user_metrics_service";
import { userDetailsFrom, UserService } from "#services/user_service";
import { mergeUsersValidator, setPermissionValidator } from "#validators/user_management";
import { updateMeValidator, updateUserValidator, userSearchValidator } from "#validators/users";

export default class UsersController {
  /** Customers confirm their own details; saving clears the confirm-details task. */
  async updateMe(ctx: HttpContext) {
    const user = ctx.auth.getUserOrFail();
    const details = await ctx.request.validateUsing(updateMeValidator, {
      meta: { detailsId: user.id },
    });
    user.merge({ ...userDetailsFrom(details), taskConfirmDetails: false });
    await user.save();
  }

  async search(ctx: HttpContext) {
    const { q } = await ctx.request.validateUsing(userSearchValidator);
    return UserService.search(q);
  }

  /** The user with both task flags brought up to date, or null when there is no such user. */
  async show(ctx: HttpContext) {
    const user = await User.find(ctx.request.param("detailsId"));
    return user === null ? null : UserService.withTasksReconciled(user);
  }

  async update(ctx: HttpContext) {
    const detailsId = ctx.request.param("detailsId");
    const { email, emailConfirmed, ...details } = await ctx.request.validateUsing(
      updateUserValidator,
      { meta: { detailsId } },
    );
    const user = await User.findOrFail(detailsId);
    await UserService.updateAsEmployee(user, {
      ...userDetailsFrom(details),
      email,
      emailConfirmed,
    });
  }

  /** For when the customer has verbally confirmed their address to an employee at the stand. */
  async confirmEmail(ctx: HttpContext) {
    const user = await User.findOrFail(ctx.request.param("detailsId"));
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
    const fromDetailsId = ctx.request.param("fromDetailsId");
    const toDetailsId = ctx.request.param("toDetailsId");
    const summaries = await UserDuplicatesService.summarizeUserDetails([
      fromDetailsId,
      toDetailsId,
    ]);
    const from = summaries.find((summary) => summary.detailsId === fromDetailsId);
    const to = summaries.find((summary) => summary.detailsId === toDetailsId);
    if (!from || !to) {
      throw new BadRequestException("Fant ikke begge kundene");
    }
    return { from, to };
  }

  async merge(ctx: HttpContext) {
    const { fromDetailsId, toDetailsId } = await ctx.request.validateUsing(mergeUsersValidator);
    await UserManagementService.mergeUsers(fromDetailsId, toDetailsId);
    return { merged: true };
  }

  async destroy(ctx: HttpContext) {
    await UserManagementService.deleteUser(ctx.request.param("detailsId"));
    return { deleted: true };
  }

  async employees() {
    return UserManagementService.getEmployees();
  }

  async setPermission(ctx: HttpContext) {
    const { detailsIds, permission } = await ctx.request.validateUsing(setPermissionValidator);
    return UserManagementService.setPermission(detailsIds, permission);
  }
}
