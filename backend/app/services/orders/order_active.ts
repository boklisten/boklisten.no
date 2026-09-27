import Order from "#models/order";
import type OrderItem from "#models/order_item";

export class OrderActive {
  public async getActiveOrders(userId: string): Promise<Order[]> {
    const orders = await Order.query().where("customer_id", userId);
    return orders.filter((order) => this.isOrderActive(order));
  }

  public async haveActiveOrders(userId: string): Promise<boolean> {
    const activeOrders = await this.getActiveOrders(userId);
    return activeOrders.length > 0;
  }

  private isOrderActive(order: Order): boolean {
    return order.placed && order.orderItems.some((orderItem) => this.isOrderItemActive(orderItem));
  }

  public isOrderItemActive(
    orderItem: Pick<OrderItem, "handout" | "delivered" | "movedToOrderId">,
  ): boolean {
    return !(orderItem.handout || orderItem.delivered || orderItem.movedToOrderId !== null);
  }
}
