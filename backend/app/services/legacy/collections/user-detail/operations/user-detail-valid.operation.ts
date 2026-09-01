import { UserDetailHelper } from "#services/legacy/collections/user-detail/helpers/user-detail.helper";
import { StorageService } from "#services/storage_service";
import { BlError } from "#shared/bl-error";
import { BlapiResponse } from "#shared/blapi-response";
import type { BlApiRequest } from "#types/bl-api-request";
import type { Operation } from "#types/operation";

export class UserDetailValidOperation implements Operation {
  private readonly userDetailHelper = new UserDetailHelper();

  async run(blApiRequest: BlApiRequest) {
    try {
      const userDetail = await StorageService.UserDetails.get(blApiRequest.documentId);

      const invalidUserDetailFields = this.userDetailHelper.getInvalidUserDetailFields(userDetail);

      if (invalidUserDetailFields.length <= 0) {
        return new BlapiResponse([{ valid: true }]);
      }

      return new BlapiResponse([{ valid: false, invalidFields: invalidUserDetailFields }]);
    } catch (error) {
      const responseError: BlError = new BlError("userDetail could not be validated");

      if (error instanceof BlError) {
        responseError.add(error);
      }

      throw responseError;
    }
  }
}
