import logger from "@adonisjs/core/services/logger";

import User from "#models/user";
import { OrderItemMovedFromOrderHandler } from "#services/orders/order_item_moved_from_order_handler";
import { OrderEmailHandler } from "#services/orders/order_email_handler";
import { StorageService } from "#services/storage_service";

interface CancellableOrderItem {
  item: string;
  title: string;
}

export const OrderCancellationService = {
  async cancelOrderItems({
    originalOrder,
    orderItems,
    employeeDetailsId,
    notifyCustomer,
  }: {
    originalOrder: { id: string; branch: string; customer: string };
    orderItems: CancellableOrderItem[];
    /** Set when an employee cancels on the customer's behalf; omit for customer-initiated cancels */
    employeeDetailsId?: string;
    notifyCustomer: boolean;
  }) {
    const cancelOrder = await StorageService.Orders.add({
      placed: true,
      payments: [],
      amount: 0,
      branch: originalOrder.branch,
      customer: originalOrder.customer,
      byCustomer: !employeeDetailsId,
      ...(employeeDetailsId && { employee: employeeDetailsId }),
      notification: { email: notifyCustomer },
      orderItems: orderItems.map((orderItem) => ({
        movedFromOrder: originalOrder.id,
        handout: false,
        delivered: true,
        item: orderItem.item,
        title: orderItem.title,
        type: "cancel" as const,
        amount: 0,
        unitPrice: 0,
      })),
    });

    await new OrderItemMovedFromOrderHandler().updateOrderItems(cancelOrder);

    // The customer may no longer exist (GDPR cleanup); the cancellation itself must still go through
    if (notifyCustomer) {
      try {
        const customer = await User.find(originalOrder.customer);
        if (customer) {
          await OrderEmailHandler.sendOrderReceipt(customer, cancelOrder);
        }
      } catch (error) {
        logger.error(
          `failed to notify customer "${originalOrder.customer}" after cancelling order "${originalOrder.id}": ${String(error)}`,
        );
      }
    }

    return cancelOrder;
  },
};
