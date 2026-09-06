import { Hook } from "#services/legacy/hook";
import { BlError } from "#shared/bl-error";
import { userDetailPatchValidator } from "#validators/user_detail";

export class UserDetailUpdateHook extends Hook {
  public override async before(body: unknown) {
    const [error, data] = await userDetailPatchValidator.tryValidate(body);
    if (error || !data) {
      throw new BlError("Invalid UserDetailUpdateType request body").code(701);
    }
    const {
      name,
      address,
      postCity,
      dob,
      postCode,
      phone,
      emailConfirmed,
      guardian,
      branchMembership,
    } = data;
    // In an update call, a value of 'undefined' will remove a key, so the key
    // needs to be completely missing if it shouldn't be updated.
    return {
      ...(name !== undefined && { name }),
      ...(address !== undefined && { address }),
      ...(postCity !== undefined && { postCity }),
      ...(dob !== undefined && { dob }),
      ...(postCode !== undefined && { postCode }),
      ...(phone !== undefined && { phone }),
      ...(emailConfirmed !== undefined && { emailConfirmed }),
      ...(branchMembership !== undefined && { branchMembership }),
      ...(guardian?.name && guardian?.email && { guardian }),
    };
  }
}
