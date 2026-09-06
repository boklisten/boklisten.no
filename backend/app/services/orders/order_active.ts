import { SEDbQuery } from "#models/mongoose/storage/db-query";
import { StorageService } from "#services/storage_service";
import { BlError } from "#shared/bl-error";
import type { Order } from "#shared/order/order";
import type { OrderItem } from "#shared/order/order-item/order-item";

export class OrderActive {
  public async getActiveOrders(userId: string): Promise<Order[]> {
    const databaseQuery = new SEDbQuery();
    databaseQuery.objectIdFilters = [{ fieldName: "customer", value: userId }];

    let orders: Order[];

    try {
      orders = await StorageService.Orders.getByQuery(databaseQuery);
    } catch (error) {
      if (error instanceof BlError && error.getCode() === 702) {
        return [];
      }
      throw error;
    }

    return orders.filter((order) => this.isOrderActive(order));
  }

  public async haveActiveOrders(userId: string): Promise<boolean> {
    const activeOrders = await this.getActiveOrders(userId);
    return activeOrders.length > 0;
  }

  private isOrderActive(order: Order): boolean {
    return order.placed && order.orderItems.some((orderItem) => this.isOrderItemActive(orderItem));
  }

  public isOrderItemActive(orderItem: OrderItem): boolean {
    return !(orderItem.handout || orderItem.delivered || Boolean(orderItem.movedToOrder));
  }
}
