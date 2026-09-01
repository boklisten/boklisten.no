import { BringDeliveryService } from "#services/legacy/collections/delivery/helpers/deliveryBring/bringDelivery.service";
import { StorageService } from "#services/storage_service";
import { BlError } from "#shared/bl-error";
import type { Branch } from "#shared/branch";
import type { Delivery } from "#shared/delivery/delivery";
import type { DeliveryInfoBring } from "#shared/delivery/delivery-info/delivery-info-bring";
import type { Item } from "#shared/item";
import type { Order } from "#shared/order/order";

export class DeliveryHandler {
  private readonly bringDeliveryService: BringDeliveryService;

  constructor(bringDeliveryService?: BringDeliveryService) {
    this.bringDeliveryService = bringDeliveryService ?? new BringDeliveryService();
  }

  public updateOrderBasedOnMethod(delivery: Delivery, order: Order): Promise<Delivery> {
    switch (delivery.method) {
      case "branch": {
        return this.updateOrderWithDeliveryMethodBranch(delivery, order);
      }
      case "bring": {
        return this.updateOrderWithDeliveryMethodBring(delivery, order);
      }
      default: {
        return Promise.reject(
          new BlError(`delivery.method "${String(delivery.method)}" is not supported`),
        );
      }
    }
  }

  private updateOrderWithDeliveryMethodBranch(delivery: Delivery, order: Order): Promise<Delivery> {
    return this.updateOrder(order, delivery)
      .then(() => delivery)
      .catch((blError: BlError) => {
        throw blError;
      });
  }

  private updateOrderWithDeliveryMethodBring(delivery: Delivery, order: Order): Promise<Delivery> {
    return new Promise((resolve, reject) => {
      void this.fetchItems(order).then((items: Item[]) =>
        this.getBringDeliveryInfoAndUpdateDelivery(order, delivery, items)
          .then((updatedDelivery: Delivery) =>
            this.updateOrder(order, updatedDelivery)
              .then(() => resolve(updatedDelivery))
              .catch((blError: BlError) => reject(blError)),
          )
          .catch((bringDeliveryInfoError) => {
            reject(new BlError("failed to get bring delivery info").add(bringDeliveryInfoError));
          }),
      );
    });
  }

  private updateOrder(order: Order, delivery: Delivery): Promise<boolean> {
    const orderUpdateData = { delivery: delivery.id };

    return StorageService.Orders.update(order.id, orderUpdateData)
      .then(() => true)
      .catch((blError: BlError) => {
        throw new BlError("could not update order").add(blError);
      });
  }

  private fetchItems(order: Order): Promise<Item[]> {
    return new Promise((resolve, reject) => {
      const itemIds: string[] = order.orderItems.map((orderItem) => orderItem.item);

      StorageService.Items.getMany(itemIds)
        .then((items: Item[]) => resolve(items))
        .catch((blError: BlError) => {
          reject(blError);
        });
    });
  }

  private getBringDeliveryInfoAndUpdateDelivery(
    order: Order,
    delivery: Delivery,
    items: Item[],
  ): Promise<Delivery> {
    return new Promise((resolve, reject) => {
      StorageService.Branches.get(order.branch)
        .then((branch: Branch) => {
          const freeDelivery =
            (branch.paymentInfo?.responsibleForDelivery ?? false) || order.handoutByDelivery;

          return this.bringDeliveryService
            .getDeliveryInfoBring(
              // @ts-expect-error fixme: auto ignored
              delivery.info["facilityAddress"],

              // @ts-expect-error fixme: auto ignored
              delivery.info["shipmentAddress"],
              items,

              // @ts-expect-error fixme: auto ignored
              freeDelivery,
            )
            .then((deliveryInfoBring: DeliveryInfoBring) => {
              // @ts-expect-error fixme: auto ignored
              if (delivery.info["trackingNumber"]) {
                deliveryInfoBring.trackingNumber =
                  // @ts-expect-error fixme: auto ignored
                  delivery.info["trackingNumber"];
              }

              return StorageService.Deliveries.update(delivery.id, {
                amount: deliveryInfoBring.amount,
                info: deliveryInfoBring,
              })
                .then((updatedDelivery: Delivery) => resolve(updatedDelivery))
                .catch((updateDeliveryError: BlError) => {
                  reject(updateDeliveryError);
                });
            })
            .catch((blError: BlError) => {
              reject(blError);
            });
        })
        .catch((getBranchError: BlError) => {
          reject(getBranchError);
        });
    });
  }
}
