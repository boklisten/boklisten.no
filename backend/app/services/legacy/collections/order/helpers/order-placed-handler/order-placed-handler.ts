import logger from "@adonisjs/core/services/logger";

import DispatchService from "#services/dispatch_service";
import { CustomerItemHandler } from "#services/legacy/collections/customer-item/helpers/customer-item-handler";
import { OrderItemMovedFromOrderHandler } from "#services/legacy/collections/order/helpers/order-item-moved-from-order-handler/order-item-moved-from-order-handler";
import { PaymentHandler } from "#services/legacy/collections/payment/helpers/payment-handler";
import { OrderEmailHandler } from "#services/legacy/order_email_handler";
import { reconcileSignatureTask } from "#services/legacy/signature.helper";
import { StorageService } from "#services/storage_service";
import { BlError } from "#shared/bl-error";
import { Order } from "#shared/order/order";
import { UserDetail } from "#shared/user-detail";

export class OrderPlacedHandler {
  private paymentHandler: PaymentHandler;

  private customerItemHandler: CustomerItemHandler;
  private orderItemMovedFromOrderHandler: OrderItemMovedFromOrderHandler;

  constructor(
    paymentHandler?: PaymentHandler,
    customerItemHandler?: CustomerItemHandler,
    orderItemMovedFromOrderHandler?: OrderItemMovedFromOrderHandler,
  ) {
    this.paymentHandler = paymentHandler ?? new PaymentHandler();

    this.customerItemHandler = customerItemHandler ?? new CustomerItemHandler();
    this.orderItemMovedFromOrderHandler =
      orderItemMovedFromOrderHandler ?? new OrderItemMovedFromOrderHandler();
  }

  public async placeOrder(order: Order, detailsId: string): Promise<Order> {
    try {
      const payments = await this.paymentHandler.confirmPayments(order);

      const paymentIds = payments.map((payment) => payment.id);

      const placedOrder = await StorageService.Orders.update(order.id, {
        placed: true,
        payments: paymentIds,
      });

      await this.updateCustomerItemsIfPresent(placedOrder, detailsId);
      await this.orderItemMovedFromOrderHandler.updateOrderItems(placedOrder);
      await this.updateUserDetailWithPlacedOrder(placedOrder);
      await this.updateSignatureTask(placedOrder);
      await this.sendOrderConfirmationMail(placedOrder);

      return placedOrder;
    } catch (error) {
      // @ts-expect-error fixme: auto ignored
      throw new BlError("could not update order: " + error).add(error);
    }
  }

  private async updateSignatureTask(order: Order): Promise<void> {
    try {
      if (!order?.customer) return;
      const userDetail = await StorageService.UserDetails.getOrNull(order.customer);
      if (!userDetail) return;
      await reconcileSignatureTask(userDetail);
    } catch (error) {
      logger.error(`could not update signature task for order ${order.id}: ${error}`);
    }
  }

  private async updateCustomerItemsIfPresent(order: Order, detailsId: string): Promise<Order> {
    for (const orderItem of order.orderItems) {
      if (
        orderItem.type === "extend" ||
        orderItem.type === "return" ||
        orderItem.type === "buyout" ||
        orderItem.type === "buyback" ||
        orderItem.type === "cancel"
      ) {
        let customerItemId = null;

        if (orderItem.info && orderItem.info.customerItem) {
          customerItemId = orderItem.info.customerItem;
        } else if (orderItem.customerItem) {
          customerItemId = orderItem.customerItem;
        }

        if (customerItemId !== null) {
          switch (orderItem.type) {
            case "extend": {
              await this.customerItemHandler.extend(
                customerItemId,
                orderItem,
                order.branch,
                order.id,
              );

              break;
            }
            case "buyout": {
              await this.customerItemHandler.buyout(customerItemId, order.id, orderItem);

              break;
            }
            case "buyback": {
              await this.customerItemHandler.buyback(customerItemId, order.id, orderItem);

              break;
            }
            case "cancel": {
              await this.customerItemHandler.cancel(customerItemId, order.id, orderItem);

              break;
            }
            case "return": {
              await this.customerItemHandler.return(
                customerItemId,
                order.id,
                orderItem,
                order.branch,
                detailsId,
              );

              break;
            }
            // No default
          }
        }
      }
    }

    return order;
  }

  private updateUserDetailWithPlacedOrder(order: Order): Promise<boolean> {
    if (!order?.customer) {
      return Promise.resolve(true);
    }
    return new Promise((resolve, reject) => {
      StorageService.UserDetails.get(order.customer)
        .then((userDetail: UserDetail) => {
          const orders = userDetail.orders ?? [];

          if (orders.includes(order.id)) {
            return resolve(true);
          } else {
            orders.push(order.id);

            return StorageService.UserDetails.update(order.customer, { orders })
              .then(() => {
                return resolve(true);
              })
              .catch(() => {
                reject(new BlError("could not update userDetail with placed order"));
              });
          }
        })
        .catch((getUserDetailError: BlError) => {
          reject(new BlError(`customer "${order.customer}" not found`).add(getUserDetailError));
        });
    });
  }

  private async sendOrderConfirmationMail(order: Order): Promise<void> {
    // makes it possible for admins to disable order alerts to customers in bl-admin
    if (order.notification && !order.notification.email) {
      return;
    }
    const customerDetail = await StorageService.UserDetails.get(order.customer);
    const delivery =
      typeof order.delivery === "string"
        ? await StorageService.Deliveries.get(order.delivery)
        : null;
    if (delivery?.info && "trackingNumber" in delivery.info) {
      await DispatchService.sendDeliveryInformation(customerDetail, order, delivery.info);
    } else {
      await OrderEmailHandler.sendOrderReceipt(customerDetail, order);
    }
  }
}
