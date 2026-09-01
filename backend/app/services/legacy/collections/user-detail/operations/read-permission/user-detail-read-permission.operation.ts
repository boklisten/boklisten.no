import { UserService } from "#services/user_service";
import { BlapiResponse } from "#shared/blapi-response";
import type { BlApiRequest } from "#types/bl-api-request";
import type { Operation } from "#types/operation";

export class UserDetailReadPermissionOperation implements Operation {
  async run(blApiRequest: BlApiRequest) {
    const user = await UserService.getByUserDetailsId(blApiRequest.documentId);
    return new BlapiResponse([{ permission: user?.permission ?? "customer" }]);
  }
}
