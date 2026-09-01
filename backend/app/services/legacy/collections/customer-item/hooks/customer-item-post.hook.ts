import { CustomerItemValidator } from "#services/legacy/collections/customer-item/validators/customer-item-validator";
import { UserDetailHelper } from "#services/legacy/collections/user-detail/helpers/user-detail.helper";
import { Hook } from "#services/legacy/hook";
import { StorageService } from "#services/storage_service";
import type { AccessToken } from "#shared/access-token";
import { BlError } from "#shared/bl-error";
import type { CustomerItem } from "#shared/customer-item/customer-item";
import type { Order } from "#shared/order/order";
import type { UserDetail } from "#shared/user-detail";

export class CustomerItemPostHook extends Hook {
  private readonly customerItemValidator: CustomerItemValidator;

  private readonly userDetailHelper: UserDetailHelper;

  constructor(customerItemValidator?: CustomerItemValidator, userDetailHelper?: UserDetailHelper) {
    super();
    this.customerItemValidator = customerItemValidator ?? new CustomerItemValidator();

    this.userDetailHelper = userDetailHelper ?? new UserDetailHelper();
  }

  public override before(customerItem: CustomerItem): Promise<boolean> {
    if (!customerItem) {
      return Promise.reject(new BlError("customerItem is undefined"));
    }

    return StorageService.UserDetails.get(customerItem.customer)
      .then((userDetail: UserDetail) => {
        if (!this.userDetailHelper.isValid(userDetail)) {
          throw new BlError(`userDetail "${customerItem.customer}" not valid`);
        }

        return this.customerItemValidator
          .validate(customerItem)
          .then(() => true)
          .catch((customerItemValidationError: BlError) => {
            throw new BlError("could not validate customerItem").add(customerItemValidationError);
          });
      })
      .catch((blError: BlError) => {
        throw blError;
      });
  }

  public override after(
    customerItems: CustomerItem[],
    accessToken: AccessToken,
  ): Promise<CustomerItem[]> {
    // we know that the customerItem that is sent here are valid, we can just update the userDetail

    if (!customerItems || customerItems.length <= 0) {
      return Promise.reject(new BlError("customerItems is empty or undefined"));
    }

    if (customerItems.length > 1) {
      return Promise.reject(new BlError("there are more than one customerItem"));
    }

    // @ts-expect-error fixme: auto ignored
    const customerItem: CustomerItem = customerItems[0];

    if (!customerItem.orders) {
      return Promise.reject(new BlError("customerItem.orders is not defined"));
    }

    if (customerItem.orders.length !== 1) {
      return Promise.reject(
        new BlError(
          `customerItem.orders.length is "${customerItem.orders.length}" but should be "1"`,
        ),
      );
    }

    return StorageService.Orders.get(customerItem.orders[0] ?? "")
      .then((order: Order) => {
        //update the corresponding orderItem with customerItem
        for (const orderItem of order.orderItems) {
          if (orderItem.item.toString() === customerItem.item.toString()) {
            orderItem.info = { customerItem: customerItem.id, ...orderItem.info };
            break;
          }
        }
        return StorageService.Orders.update(order.id, {
          orderItems: order.orderItems,
        });
      })
      .then(() => StorageService.UserDetails.get(customerItem.customer))
      .then((userDetail: UserDetail) =>
        StorageService.UserDetails.update(userDetail.id, {
          customerItems: [...userDetail.customerItems, customerItem.id],
        }),
      )
      .then(() => [customerItem])
      .catch((blError: BlError) => {
        throw blError.store("userDetail", accessToken.sub).store("customerItemId", customerItem.id);
      });
  }
}
