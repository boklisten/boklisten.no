import { DeliveryHandler } from "#services/legacy/collections/delivery/helpers/deliveryHandler/delivery-handler";
import { DeliveryValidator } from "#services/legacy/collections/delivery/helpers/deliveryValidator/delivery-validator";
import { Hook } from "#services/legacy/hook";
import { StorageService } from "#services/storage_service";
import type { AccessToken } from "#shared/access-token";
import { BlError } from "#shared/bl-error";
import type { Delivery } from "#shared/delivery/delivery";
import type { Order } from "#shared/order/order";

export class DeliveryPostHook extends Hook {
  private readonly deliveryValidator: DeliveryValidator;
  private readonly deliveryHandler: DeliveryHandler;

  constructor(deliveryValidator?: DeliveryValidator, deliveryHandler?: DeliveryHandler) {
    super();
    this.deliveryValidator = deliveryValidator ?? new DeliveryValidator();
    this.deliveryHandler = deliveryHandler ?? new DeliveryHandler();
  }

  public override after(deliveries: Delivery[], accessToken?: AccessToken): Promise<Delivery[]> {
    if (!deliveries || deliveries.length <= 0) {
      return Promise.reject(new BlError("deliveries is empty or undefined"));
    }

    if (deliveries.length > 1) {
      return Promise.reject(new BlError("can not add more than one delivery"));
    }

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
                .updateOrderBasedOnMethod(delivery, order, accessToken)
                .then((updatedDelivery: Delivery) => resolve([updatedDelivery]))
                .catch((blError: BlError) => reject(blError)),
            )
            .catch((blError: BlError) => reject(blError)),
        )
        .catch((blError: BlError) => reject(blError));
    });
  }
}
