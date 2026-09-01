import { Hook } from "#services/legacy/hook";
import { SEDbQuery } from "#services/legacy/query/se.db-query";
import { StorageService } from "#services/storage_service";
import type { AccessToken } from "#shared/access-token";
import { BlError } from "#shared/bl-error";
import { userDetailPatchValidator } from "#validators/user_detail";

export class UserDetailUpdateHook extends Hook {
  public override async before(body: unknown, accessToken: AccessToken) {
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
    if (emailConfirmed !== undefined && accessToken.permission === "customer") {
      throw new BlError("bruker kan ikke endre egen e-post-bekreftet-status").code(911);
    }

    const databaseQuery = new SEDbQuery();
    databaseQuery.stringFilters = [{ fieldName: "phone", value: phone ?? "" }];
    let existingUsers = [];
    try {
      existingUsers = (await StorageService.UserDetails.getByQuery(databaseQuery)).filter(
        (user) => user.id !== accessToken.details,
      );
    } catch {
      // Not found
    }
    if (existingUsers.length > 0 && accessToken.permission === "customer") {
      throw new BlError("telefonnummer er allerede registrert på en annen bruker").code(912);
    }

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
