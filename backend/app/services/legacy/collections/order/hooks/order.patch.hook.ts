import { OrderPlacedHandler } from "#services/legacy/collections/order/helpers/order-placed-handler/order-placed-handler";
import { OrderValidator } from "#services/legacy/collections/order/helpers/order-validator/order-validator";
import { Hook } from "#services/legacy/hook";
import { PermissionService } from "#services/permission_service";
import { StorageService } from "#services/storage_service";
import { AccessToken } from "#shared/access-token";
import { BlError } from "#shared/bl-error";
import { Order } from "#shared/order/order";

export class OrderPatchHook extends Hook {
  private orderValidator: OrderValidator;
  private orderPlacedHandler: OrderPlacedHandler;

  constructor(orderValidator?: OrderValidator, orderPlacedHandler?: OrderPlacedHandler) {
    super();
    this.orderValidator = orderValidator ?? new OrderValidator();
    this.orderPlacedHandler = orderPlacedHandler ?? new OrderPlacedHandler();
  }

  override before(body: unknown, accessToken: AccessToken, id: string): Promise<boolean> {
    if (!body) {
      return Promise.reject(new BlError("body not defined"));
    }

    if (!accessToken) {
      return Promise.reject(new BlError("accessToken not defined"));
    }

    if (!id) {
      return Promise.reject(new BlError("id not defined"));
    }

    return Promise.resolve(true);
  }

  override after(orders: Order[], accessToken: AccessToken): Promise<Order[]> {
    if (orders.length > 1) {
      return Promise.reject(new BlError("can only patch one order at a time"));
    }

    if (!accessToken) {
      return Promise.reject(new BlError("accessToken not defined"));
    }
    const isAdmin = PermissionService.isPermissionEqualOrOver(accessToken.permission, "admin");

    const order = orders[0];

    return new Promise((resolve, reject) => {
      if (order?.placed) {
        this.orderPlacedHandler
          .placeOrder(order, accessToken.details)
          .then((placedOrder) => {
            return resolve([placedOrder]);
          })
          .catch((orderPlacedError: BlError) => {
            reject(new BlError("order could not be placed").add(orderPlacedError));
          });
      } else {
        this.orderValidator

          // @ts-expect-error fixme: auto ignored
          .validate(order, isAdmin)
          .then(() => {
            // @ts-expect-error fixme: auto ignored
            return resolve([order]);
          })
          .catch((validationError: BlError) => {
            if (order?.placed) {
              StorageService.Orders.update(order.id, { placed: false })
                .then(() => {
                  return reject(
                    new BlError(
                      "validation of patch of order failed, order.placed is set to false",
                    ).add(validationError),
                  );
                })
                .catch((updateError: BlError) => {
                  return reject(
                    new BlError("could not set order.placed to false when order validation failed")
                      .add(updateError)
                      .add(validationError),
                  );
                });
            } else {
              return reject(
                new BlError("patch of order could not be validated").add(validationError),
              );
            }
          });
      }
    });
  }
}
