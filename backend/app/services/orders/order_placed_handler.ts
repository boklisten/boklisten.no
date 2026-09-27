import logger from "@adonisjs/core/services/logger";

import Delivery from "#models/delivery";
import type Order from "#models/order";
import User from "#models/user";
import DispatchService from "#services/dispatch_service";
import { CustomerItemHandler } from "#services/customer_items/customer_item_handler";
import { OrderItemMovedFromOrderHandler } from "#services/orders/order_item_moved_from_order_handler";
import { PaymentHandler } from "#services/orders/payment_handler";
import { OrderEmailHandler } from "#services/orders/order_email_handler";
import { reconcileSignatureTask } from "#services/signature_helper";
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

      await this.updateCustomerItems(order, detailsId);
      await this.orderItemMovedFromOrderHandler.updateOrderItems(order);
      const customer = order.customerId ? await User.find(order.customerId) : null;
      if (customer) {
        await this.updateSignatureTask(order, customer);
        await this.sendOrderConfirmationMail(order, customer);
      }

      return order;
    } catch (error) {
      // @ts-expect-error fixme: auto ignored
      throw new BlError(`could not update order: ${String(error)}`).add(error);
    }
  }

  private async updateSignatureTask(order: Order, customer: User): Promise<void> {
    try {
      await reconcileSignatureTask(customer);
    } catch (error) {
      logger.error(`could not update signature task for order ${order.id}: ${String(error)}`);
    }
  }

  private async updateCustomerItems(order: Order, detailsId: string): Promise<void> {
    for (const orderItem of order.orderItems) {
      const { customerItemId } = orderItem;
      if (customerItemId === null) {
        continue;
      }
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
        default: {
          break;
        }
      }
    }
  }

  private async sendOrderConfirmationMail(order: Order, customer: User): Promise<void> {
    // makes it possible for admins to disable order alerts to customers in bl-admin
    if (!order.notifyByEmail) {
      return;
    }
    const delivery = await Delivery.ofOrder(order.id);
    await (delivery?.trackingNumber
      ? DispatchService.sendDeliveryInformation(customer, order, delivery)
      : OrderEmailHandler.sendOrderReceipt(customer, order));
  }
}
