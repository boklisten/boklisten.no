import { DeliveryHandler } from "#services/legacy/collections/delivery/helpers/deliveryHandler/delivery-handler";
import { DeliveryValidator } from "#services/legacy/collections/delivery/helpers/deliveryValidator/delivery-validator";
import { Hook } from "#services/legacy/hook";
import { StorageService } from "#services/storage_service";
import type { AccessToken } from "#shared/access-token";
import { BlError } from "#shared/bl-error";
import type { Delivery } from "#shared/delivery/delivery";
import type { Order } from "#shared/order/order";

export class DeliveryPatchHook extends Hook {
  private readonly deliveryValidator: DeliveryValidator;

  private readonly deliveryHandler: DeliveryHandler;

  constructor(deliveryValidator?: DeliveryValidator, deliveryHandler?: DeliveryHandler) {
    super();
    this.deliveryValidator = deliveryValidator ?? new DeliveryValidator();

    this.deliveryHandler = deliveryHandler ?? new DeliveryHandler();
  }

  override before(body: unknown, accessToken?: AccessToken, id?: string): Promise<boolean> {
    if (!body) {
      return Promise.reject(new BlError("body is undefined"));
    }

    if (!id) {
      return Promise.reject(new BlError("id is undefined"));
    }

    if (!accessToken) {
      return Promise.reject(new BlError("accessToken is undefined"));
    }

    return this.tryToValidatePatch(body, id)
      .then(() => true)
      .catch((blError: BlError) => {
        throw blError;
      });
  }

  override after(deliveries: Delivery[]): Promise<Delivery[]> {
    const delivery = deliveries[0];

    return new Promise((resolve, reject) => {
      StorageService.Orders
        // @ts-expect-error fixme: auto ignored
        .get(delivery.order)
        .then((order: Order) =>
          this.deliveryValidator
            // @ts-expect-error fixme: auto ignored
            .validate(delivery)
            .then(() =>
              this.deliveryHandler
                // @ts-expect-error fixme: auto ignored
                .updateOrderBasedOnMethod(delivery, order)
                .then((updatedDelivery: Delivery) => resolve([updatedDelivery]))
                .catch((blError: BlError) => reject(blError)),
            )
            .catch((blError: BlError) => reject(blError)),
        )
        .catch((blError: BlError) => reject(blError));
    });
  }

  private tryToValidatePatch(body: any, id: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      StorageService.Deliveries.get(id)
        .then((delivery: Delivery) => {
          if (body["info"]) {
            delivery.info = body["info"];
          }

          if (body["amount"] >= 0) {
            delivery.amount = body["amount"];
          }

          if (body["order"]) {
            delivery.order = body["order"];
          }
          if (body["method"]) {
            delivery.method = body["method"];
          }
          return this.deliveryValidator
            .validate(delivery)
            .then(() => resolve(true))
            .catch((blError: BlError) =>
              reject(
                new BlError("patched delivery could not be validated")
                  .add(blError)
                  .store("delivery", delivery),
              ),
            );
        })
        .catch((blError: BlError) =>
          reject(new BlError(`delivery "${id}" not found`).add(blError)),
        );
    });
  }
}
