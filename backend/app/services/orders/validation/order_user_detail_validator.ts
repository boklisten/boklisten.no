import { StorageService } from "#services/storage_service";
import { BlError } from "#shared/bl-error";
import type { Order } from "#shared/order/order";
import type { UserDetail } from "#shared/user-detail";

export class OrderUserDetailValidator {
  public validate(order: Order): Promise<boolean> {
    return StorageService.UserDetails.get(order.customer)
      .then(
        (_userDetail: UserDetail) =>
          /*
        if (!userDetail.emailConfirmed) {
          throw new BlError('userDetail.emailConfirmed is not true');
        }
        */

          true,
      )
      .catch((userDetailValidateError: BlError) => {
        throw new BlError("userDetail could not be validated").add(userDetailValidateError);
      });
  }
}
