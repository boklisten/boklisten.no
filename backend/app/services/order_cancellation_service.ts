import logger from "@adonisjs/core/services/logger";

import Order from "#models/order";
import User from "#models/user";
import { OrderItemMovedFromOrderHandler } from "#services/orders/order_item_moved_from_order_handler";
import { OrderEmailHandler } from "#services/orders/order_email_handler";

interface CancellableOrderItem {
  itemId: string;
}

export const OrderCancellationService = {
  async cancelOrderItems({
    originalOrder,
    orderItems,
    employeeId,
    notifyCustomer,
  }: {
    originalOrder: Pick<Order, "id" | "branchId" | "customerId">;
    orderItems: CancellableOrderItem[];
    /** Set when an employee cancels on the customer's behalf; omit for customer-initiated cancels */
    employeeId?: string;
    notifyCustomer: boolean;
  }) {
    const cancelOrder = await Order.createWithItems({
      placed: true,
      amount: 0,
      branchId: originalOrder.branchId,
      customerId: originalOrder.customerId,
      byCustomer: !employeeId,
      employeeId: employeeId ?? null,
      notifyByEmail: notifyCustomer,
      orderItems: orderItems.map((orderItem) => ({
        movedFromOrderId: originalOrder.id,
        handout: false,
        delivered: true,
        itemId: orderItem.itemId,
        type: "cancel" as const,
        amount: 0,
        unitPrice: 0,
      })),
    });

    await new OrderItemMovedFromOrderHandler().updateOrderItems(cancelOrder);

    // The customer may no longer exist (GDPR cleanup); the cancellation itself must still go through
    if (notifyCustomer && originalOrder.customerId !== null) {
      try {
        const customer = await User.find(originalOrder.customerId);
        if (customer) {
          await OrderEmailHandler.sendOrderReceipt(customer, cancelOrder);
        }
      } catch (error) {
        logger.error(
          `failed to notify customer "${originalOrder.customerId}" after cancelling order "${originalOrder.id}": ${String(error)}`,
        );
      }
    }

    return cancelOrder;
  },
};
