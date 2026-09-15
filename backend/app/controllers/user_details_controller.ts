import type { HttpContext } from "@adonisjs/core/http";

import { UserDetailHelper } from "#services/user_detail_helper";
import { reconcileSignatureTask } from "#services/signature_helper";
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
  if (!userDetail) {
    return null;
  }

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
  async me(ctx: HttpContext) {
    return getUserDetail(ctx.authUser.detailsId);
  }

  async updateMe(ctx: HttpContext) {
    const { detailsId } = ctx.authUser;
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

  async search(ctx: HttpContext) {
    const { searchStr } = await ctx.request.validateUsing(userDetailSearchValidator);
    return UserDetailService.search(searchStr);
  }

  async show(ctx: HttpContext) {
    return getUserDetail(ctx.request.param("detailsId"));
  }

  async update(ctx: HttpContext) {
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
    await UserDetailService.updateAsEmployee(targetUserDetailsId, {
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
    });
  }

  /** For when the customer has verbally confirmed their address to an employee at the stand. */
  async confirmEmail(ctx: HttpContext) {
    const detailsId = ctx.request.param("detailsId");
    const userDetail = await StorageService.UserDetails.getOrNull(detailsId);
    if (!userDetail) {
      return ctx.response.notFound();
    }
    await StorageService.UserDetails.update(detailsId, { emailConfirmed: true });
    return { emailConfirmed: true };
  }
}
