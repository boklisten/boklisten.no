import logger from "@adonisjs/core/services/logger";

import { OrderItemMovedFromOrderHandler } from "#services/legacy/collections/order/helpers/order-item-moved-from-order-handler/order-item-moved-from-order-handler";
import { OrderEmailHandler } from "#services/legacy/order_email_handler";
import { StorageService } from "#services/storage_service";

export interface CancellableOrderItem {
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
      pendingSignature: false,
      notification: { email: notifyCustomer },
      orderItems: orderItems.map((orderItem) => ({
        movedFromOrder: originalOrder.id,
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
    try {
      const customerDetail = await StorageService.UserDetails.get(originalOrder.customer);
      const orders = customerDetail.orders ?? [];
      if (!orders.includes(cancelOrder.id)) {
        await StorageService.UserDetails.update(originalOrder.customer, {
          orders: [...orders, cancelOrder.id],
        });
      }
      if (notifyCustomer) {
        await OrderEmailHandler.sendOrderReceipt(customerDetail, cancelOrder);
      }
    } catch (error) {
      logger.error(
        `failed to update or notify customer "${originalOrder.customer}" after cancelling order "${originalOrder.id}": ${error}`,
      );
    }

    return cancelOrder;
  },
};
