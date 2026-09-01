import { Hook } from "#services/legacy/hook";
import { PermissionService } from "#services/permission_service";
import type { AccessToken } from "#shared/access-token";
import { BlError } from "#shared/bl-error";

export class PaymentGetAllHook extends Hook {
  public override async before(
    body: unknown,
    accessToken?: AccessToken,
    id?: string,
    query?: any,
  ): Promise<boolean> {
    if (
      !PermissionService.isPermissionOver(
        // @ts-expect-error fixme: auto ignored
        accessToken.permission,
        "customer",
      )
    ) {
      if (!query || !query["info.paymentId"]) {
        throw new BlError("no permission");
      }

      if (query["info.paymentId"].length <= 10) {
        throw new BlError("no permission");
      }
    }

    return true;
  }
}
