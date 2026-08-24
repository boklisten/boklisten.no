import { HttpContext } from "@adonisjs/core/http";

import { UserDetailHelper } from "#services/legacy/collections/user-detail/helpers/user-detail.helper";
import { reconcileSignatureTask } from "#services/legacy/signature.helper";
import { PermissionService } from "#services/permission_service";
import { StorageService } from "#services/storage_service";
import { UserDetailService } from "#services/user_detail_service";
import { UserService } from "#services/user_service";
import {
  customerUpdateUserDetailsValidator,
  employeeUpdateUserDetailsValidator,
  userDetailSearchValidator,
} from "#validators/user_detail";

async function getUserDetail(detailsId: string) {
  let userDetail = await StorageService.UserDetails.getOrNull(detailsId);
  if (!userDetail) return null;

  if (!new UserDetailHelper().isValid(userDetail)) {
    userDetail = await StorageService.UserDetails.update(detailsId, {
      "tasks.confirmDetails": true,
    });
  }
  userDetail = await reconcileSignatureTask(userDetail);
  const user = await UserService.getByUserDetailsId(detailsId);
  return { ...userDetail, permission: user?.permission ?? "customer" };
}

export default class UserDetailsController {
  async getMyDetails(ctx: HttpContext) {
    const { detailsId } = PermissionService.authenticate(ctx);
    return getUserDetail(detailsId);
  }
  async getById(ctx: HttpContext) {
    PermissionService.employeeOrFail(ctx);
    return getUserDetail(ctx.request.param("detailsId"));
  }
  async search(ctx: HttpContext) {
    PermissionService.employeeOrFail(ctx);
    const { searchStr } = await ctx.request.validateUsing(userDetailSearchValidator);
    return UserDetailService.search(searchStr);
  }
  /** For when the customer has verbally confirmed their address to an employee at the stand. */
  async confirmEmail(ctx: HttpContext) {
    PermissionService.employeeOrFail(ctx);
    const detailsId = ctx.request.param("detailsId");
    const userDetail = await StorageService.UserDetails.getOrNull(detailsId);
    if (!userDetail) {
      return ctx.response.notFound();
    }
    await StorageService.UserDetails.update(detailsId, { emailConfirmed: true });
    return { emailConfirmed: true };
  }
  async updateAsCustomer(ctx: HttpContext) {
    const { detailsId } = PermissionService.authenticate(ctx);
    const { phoneNumber, name, address, postalCode, postalCity, dob, branchMembership, guardian } =
      await ctx.request.validateUsing(customerUpdateUserDetailsValidator, {
        meta: {
          detailsId,
        },
      });
    await StorageService.UserDetails.update(detailsId, {
      phone: phoneNumber,
      name,
      address,
      postCode: postalCode,
      postCity: postalCity,
      dob,
      branchMembership,
      guardian,
      "tasks.confirmDetails": false,
    });
  }

  async updateAsEmployee(ctx: HttpContext) {
    PermissionService.employeeOrFail(ctx);
    const targetUserDetailsId = ctx.request.param("detailsId");
    const {
      emailVerified,
      email,
      phoneNumber,
      name,
      address,
      postalCode,
      postalCity,
      dob,
      branchMembership,
      guardian,
    } = await ctx.request.validateUsing(employeeUpdateUserDetailsValidator, {
      meta: {
        detailsId: targetUserDetailsId,
      },
    });
    await StorageService.UserDetails.update(targetUserDetailsId, {
      emailConfirmed: emailVerified,
      email,
      phone: phoneNumber,
      name,
      address,
      postCode: postalCode,
      postCity: postalCity,
      dob,
      branchMembership,
      guardian,
      "tasks.confirmDetails": false,
    });
  }
}
