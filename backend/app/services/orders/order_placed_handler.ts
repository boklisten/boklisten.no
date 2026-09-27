import logger from "@adonisjs/core/services/logger";

import type Order from "#models/order";
import User from "#models/user";
import DispatchService from "#services/dispatch_service";
import { CustomerItemHandler } from "#services/customer_items/customer_item_handler";
import { OrderItemMovedFromOrderHandler } from "#services/orders/order_item_moved_from_order_handler";
import { PaymentHandler } from "#services/orders/payment_handler";
import { OrderEmailHandler } from "#services/orders/order_email_handler";
import { reconcileSignatureTask } from "#services/signature_helper";
import { StorageService } from "#services/storage_service";
import { BlError } from "#shared/bl-error";

export class OrderPlacedHandler {
  private readonly paymentHandler: PaymentHandler;

  private readonly customerItemHandler: CustomerItemHandler;
  private readonly orderItemMovedFromOrderHandler: OrderItemMovedFromOrderHandler;

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
      await this.paymentHandler.confirmPayments(order);

      order.placed = true;
      await order.save();

      await this.updateCustomerItemsIfPresent(order, detailsId);
      await this.orderItemMovedFromOrderHandler.updateOrderItems(order);
      await this.updateUserDetailWithPlacedOrder(order);
      await this.updateSignatureTask(order);
      await this.sendOrderConfirmationMail(order);

      return order;
    } catch (error) {
      // @ts-expect-error fixme: auto ignored
      throw new BlError(`could not update order: ${String(error)}`).add(error);
    }
  }

  private async updateSignatureTask(order: Order): Promise<void> {
    try {
      if (!order.customerId) {
        return;
      }
      const user = await User.find(order.customerId);
      if (!user) {
        return;
      }
      await reconcileSignatureTask(user);
    } catch (error) {
      logger.error(`could not update signature task for order ${order.id}: ${String(error)}`);
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
        const customerItemId = orderItem.customerItemId;

        if (customerItemId !== null) {
          switch (orderItem.type) {
            case "extend": {
              await this.customerItemHandler.extend(customerItemId, orderItem, order.branchId);

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
                orderItem,
                order.branchId,
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

  private async updateUserDetailWithPlacedOrder(order: Order): Promise<boolean> {
    if (!order.customerId) {
      return true;
    }
    // The customer's orders are found through `orders.customer_id`; only the customer must exist.
    const customer = await User.find(order.customerId);
    if (!customer) {
      throw new BlError(`customer "${order.customerId}" not found`);
    }
    return true;
  }

  private async sendOrderConfirmationMail(order: Order): Promise<void> {
    // makes it possible for admins to disable order alerts to customers in bl-admin
    if (!order.notifyByEmail || order.customerId === null) {
      return;
    }
    const customerDetail = await User.findOrFail(order.customerId);
    const delivery = order.deliveryId
      ? await StorageService.Deliveries.get(order.deliveryId)
      : null;
    await (delivery?.info && "trackingNumber" in delivery.info
      ? DispatchService.sendDeliveryInformation(customerDetail, order, delivery.info)
      : OrderEmailHandler.sendOrderReceipt(customerDetail, order));
  }
}
