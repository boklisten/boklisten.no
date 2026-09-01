import { isUnderage } from "#models/signature";
import { isNullish } from "#services/legacy/typescript-helpers";
import type { UserDetail } from "#shared/user-detail";

export class UserDetailHelper {
  public isValid(userDetail: UserDetail): boolean {
    const invalidUserDetailFields = this.getInvalidUserDetailFields(userDetail);

    // @ts-expect-error fixme: auto ignored
    return invalidUserDetailFields.length <= 0 && userDetail.active;
  }

  public getInvalidUserDetailFields(userDetail: UserDetail) {
    const invalidFields = [];

    if (isNullish(userDetail.name) || userDetail.name.length <= 0) {
      invalidFields.push("name");
    }

    if (isNullish(userDetail.address) || userDetail.address.length <= 0) {
      invalidFields.push("address");
    }

    if (isNullish(userDetail.postCode) || userDetail.postCode.length <= 0) {
      invalidFields.push("postCode");
    }

    if (isNullish(userDetail.postCity) || userDetail.postCity.length <= 0) {
      invalidFields.push("postCity");
    }

    if (isNullish(userDetail.phone) || userDetail.phone.length <= 0) {
      invalidFields.push("phone");
    }
    /* fixme: enable at some point
    if (
      isNullish(userDetail.branchMembership) ||
      userDetail.branchMembership.length <= 0
    ) {
      invalidFields.push("branchMembership");
    }
    if (
      isNullish(userDetail.emailConfirmed) ||
      !userDetail.emailConfirmed
    ) {
      invalidFields.push('emailConfirmed');
    }
    */

    if (isNullish(userDetail.dob)) {
      invalidFields.push("dob");
    } else if (isUnderage(userDetail)) {
      if (isNullish(userDetail.guardian?.name) || userDetail.guardian.name.length <= 0) {
        invalidFields.push("guardian.name");
      }

      if (isNullish(userDetail.guardian?.email) || userDetail.guardian.email.length <= 0) {
        invalidFields.push("guardian.email");
      }

      if (isNullish(userDetail.guardian?.phone) || userDetail.guardian.phone.length <= 0) {
        invalidFields.push("guardian.phone");
      }
    }

    return invalidFields;
  }
}
