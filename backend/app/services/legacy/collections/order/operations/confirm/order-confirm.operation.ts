import { OrderPlacedHandler } from "#services/legacy/collections/order/helpers/order-placed-handler/order-placed-handler";
import { SEDbQueryBuilder } from "#services/legacy/query/se.db-query-builder";
import { StorageService } from "#services/storage_service";
import type { AccessToken } from "#shared/access-token";
import { BlError } from "#shared/bl-error";
import { BlapiResponse } from "#shared/blapi-response";
import type { Order } from "#shared/order/order";
import type { BlApiRequest } from "#types/bl-api-request";
import type { Operation } from "#types/operation";

export class OrderConfirmOperation implements Operation {
  private readonly queryBuilder = new SEDbQueryBuilder();
  private readonly orderPlacedHandler: OrderPlacedHandler;

  constructor(orderPlacedHandler?: OrderPlacedHandler) {
    this.orderPlacedHandler = orderPlacedHandler ?? new OrderPlacedHandler();
  }

  private filterOrdersByAlreadyOrdered(orders: Order[]) {
    const customerOrderItems = [];

    for (const order of orders) {
      if (order.orderItems) {
        for (const orderItem of order.orderItems) {
          if (order.handoutByDelivery || !order.byCustomer) {
            continue;
          }

          if (orderItem.handout) {
            continue;
          }

          if (orderItem.movedToOrder) {
            continue;
          }

          if (
            orderItem.type === "rent" ||
            orderItem.type === "buy" ||
            orderItem.type === "partly-payment"
          ) {
            customerOrderItems.push(orderItem);
          }
        }
      }
    }
    return customerOrderItems;
  }

  private async hasOpenOrderWithOrderItems(order: Order) {
    const databaseQuery = this.queryBuilder.getDbQuery(
      { customer: order.customer, placed: "true" },
      [
        { fieldName: "customer", type: "object-id" },
        { fieldName: "placed", type: "boolean" },
      ],
    );

    try {
      const existingOrders = await StorageService.Orders.getByQuery(databaseQuery);
      const alreadyOrderedItems = this.filterOrdersByAlreadyOrdered(existingOrders);

      for (const orderItem of order.orderItems) {
        for (const alreadyOrderedItem of alreadyOrderedItems) {
          const deadline = orderItem.info?.to;
          const alreadyOrderedDeadline = alreadyOrderedItem.info?.to;
          if (
            orderItem.item === alreadyOrderedItem.item &&
            deadline != null &&
            alreadyOrderedDeadline != null &&
            new Date(deadline).getTime() === new Date(alreadyOrderedDeadline).getTime()
          ) {
            return true;
          }
        }
      }
    } catch {
      console.log("could not get user orders");
    }

    return false;
  }

  public async run(blApiRequest: BlApiRequest) {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- legacy request context carries only these fields; downstream only reads them
    const accessToken = {
      // @ts-expect-error fixme: auto ignored
      details: blApiRequest.user.id,
      // @ts-expect-error fixme: auto ignored
      permission: blApiRequest.user.permission,
    } as AccessToken;

    let order;

    try {
      order = await StorageService.Orders.get(blApiRequest.documentId);
    } catch {
      throw new BlError(`order "${blApiRequest.documentId}" not found`);
    }

    const alreadyOrderedSomeItems = await this.hasOpenOrderWithOrderItems(order);

    if (alreadyOrderedSomeItems) {
      throw new BlError("There already exists an order with some of these orderitems");
    }

    let placedOrder;

    try {
      placedOrder = await this.orderPlacedHandler.placeOrder(order, accessToken.details);
    } catch (error) {
      throw new BlError(`order could not be placed:${String(error)}`);
    }
    return new BlapiResponse([placedOrder]);
  }
}
