import * as Sentry from "@sentry/node";
import { DateTime } from "luxon";

import { OrderToCustomerItemGenerator } from "#services/legacy/collections/customer-item/helpers/order-to-customer-item-generator";
import { OrderPlacedHandler } from "#services/legacy/collections/order/helpers/order-placed-handler/order-placed-handler";
import { OrderValidator } from "#services/legacy/collections/order/helpers/order-validator/order-validator";
import { SEDbQueryBuilder } from "#services/legacy/query/se.db-query-builder";
import { isNotNullish } from "#services/legacy/typescript-helpers";
import { MatchRepository } from "#services/matches/match_repository";
import { PermissionService } from "#services/permission_service";
import { StorageService } from "#services/storage_service";
import { BlError } from "#shared/bl-error";
import { BlapiResponse } from "#shared/blapi-response";
import type { CustomerItem } from "#shared/customer-item/customer-item";
import type { Order } from "#shared/order/order";
import type { OrderItem } from "#shared/order/order-item/order-item";
import type { OrderItemType } from "#shared/order/order-item/order-item-type";
import type { UserPermission } from "#shared/user-permission";
import type { BlApiRequest } from "#types/bl-api-request";
import type { Operation } from "#types/operation";

export class OrderPlaceOperation implements Operation {
  private readonly queryBuilder = new SEDbQueryBuilder();
  private readonly orderToCustomerItemGenerator: OrderToCustomerItemGenerator;
  private readonly orderPlacedHandler: OrderPlacedHandler;
  private readonly orderValidator: OrderValidator;

  constructor(
    orderToCustomerItemGenerator?: OrderToCustomerItemGenerator,
    orderPlacedHandler?: OrderPlacedHandler,
    orderValidator?: OrderValidator,
  ) {
    this.orderToCustomerItemGenerator =
      orderToCustomerItemGenerator ?? new OrderToCustomerItemGenerator();

    this.orderPlacedHandler = orderPlacedHandler ?? new OrderPlacedHandler();

    this.orderValidator = orderValidator ?? new OrderValidator();
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

  /**
   * Check whether a blid in the order is already handed out
   *
   * Unable to check against legacy customeritems which have no blid, but there
   * are very few of those which are not returned. Only checks whether a blid is
   * already handed out if the handout order type of the item in this order is
   * "buy", "rent" or "partly-payment".
   *
   * @param order The Order which contains items
   * @private
   */
  private async isSomeBlidAlreadyHandedOut(order: Order): Promise<boolean> {
    const handoutOrderTypes = new Set<OrderItemType>(["buy", "rent", "partly-payment"]);
    const handoutItems = order.orderItems.filter(
      (orderItem) => handoutOrderTypes.has(orderItem.type) && orderItem.blid != null,
    );
    if (handoutItems.length === 0) {
      return false;
    }

    try {
      // Use an aggregation because the query builder does not support checking against a list of blids,
      // and we would otherwise have to send a query for every single order item.
      const unreturnedItems = await StorageService.CustomerItems.aggregate([
        {
          $match: {
            blid: {
              $in: handoutItems.map((handoutItem) => handoutItem.blid),
            },
            returned: false,
            // In some cases, books that have previously been bought out get returned
            // to Boklistens possesion without being registered as a buyback
            // Therefore, it should be possible to hand out books that have been bought out
            buyout: false,
          },
        },
      ]);
      return unreturnedItems.length > 0;
    } catch {
      console.error("Could not check whether some items are already handed out");
      return false;
    }
  }

  /**
   * Record every book this order physically moved between the stand and the customer.
   *
   * A stand return is `customer -> stand`, a stand handout `stand -> customer`. Each is recorded
   * whether or not it settles an obligation: `book_handovers` is the chain of custody, and a book
   * moving outside any match is worth knowing about too.
   *
   * Runs only after the order is fully placed and validated. A handover row discharges match
   * obligations, and a discharge for a placement that then failed would show books as delivered
   * that never moved — worse than the recoverable opposite, a placed order whose handover
   * recording failed.
   * @private
   */
  private async recordStandHandovers(
    returnOrderItems: OrderItem[],
    handoutOrderItems: OrderItem[],
    orderId: string,
  ) {
    if (returnOrderItems.length === 0 && handoutOrderItems.length === 0) {
      return;
    }

    const [returnCustomerItems, handoutCustomerItems] = await Promise.all([
      StorageService.CustomerItems.getMany(
        returnOrderItems.map((orderItem) => orderItem.customerItem).filter(isNotNullish),
      ),
      StorageService.CustomerItems.getMany(
        handoutOrderItems.map((orderItem) => orderItem.customerItem).filter(isNotNullish),
      ),
    ]);

    for (const customerItem of returnCustomerItems) {
      const obligation = await MatchRepository.findSenderObligation(
        customerItem.customer,
        customerItem.item,
      );
      await MatchRepository.recordHandover({
        blid: customerItem.blid ?? null,
        itemId: customerItem.item,
        fromUserDetailId: customerItem.customer,
        toUserDetailId: null,
        occurredAt: DateTime.now(),
        orderId,
        dischargesSenderObligationId: obligation?.id ?? null,
        dischargesReceiverObligationId: null,
      });
    }

    for (const customerItem of handoutCustomerItems) {
      const obligation = await MatchRepository.findReceiverObligation(
        customerItem.customer,
        customerItem.item,
      );
      await MatchRepository.recordHandover({
        blid: customerItem.blid ?? null,
        itemId: customerItem.item,
        fromUserDetailId: null,
        toUserDetailId: customerItem.customer,
        occurredAt: DateTime.now(),
        orderId,
        dischargesSenderObligationId: null,
        dischargesReceiverObligationId: obligation?.id ?? null,
      });
    }
  }

  public async run(blApiRequest: BlApiRequest) {
    let order: Order;

    try {
      order = await StorageService.Orders.get(blApiRequest.documentId);
    } catch {
      throw new ReferenceError(`order "${blApiRequest.documentId}" not found`);
    }

    if (order.byCustomer) {
      const orderContainsActiveCustomerItems = await this.hasOpenOrderWithOrderItems(order);
      if (orderContainsActiveCustomerItems) {
        throw new BlError("Order contains active customer items").code(500);
      }
    }

    const someBlidAlreadyHandedOut = await this.isSomeBlidAlreadyHandedOut(order);

    if (someBlidAlreadyHandedOut) {
      throw new BlError(
        "En eller flere av bøkene du prøver å dele ut er allerede aktiv på en annen kunde. Prøv å dele ut én og én bok for å finne ut hvilke bøker dette gjelder.",
      ).code(801);
    }

    const returnOrderItems = order.orderItems.filter(
      (orderItem) => orderItem.type === "return" || orderItem.type === "buyback",
    );
    const handoutOrderItems = order.orderItems.filter(
      (orderItem) => orderItem.handout && orderItem.type === "rent",
    );

    let customerItems = await this.orderToCustomerItemGenerator.generate(order);

    if (customerItems && customerItems.length > 0) {
      customerItems = await this.addCustomerItems(
        customerItems,
        // @ts-expect-error // fixme: bad enums
        blApiRequest.user,
      );
      order = this.addCustomerItemIdToOrderItems(order, customerItems);

      await StorageService.Orders.update(
        order.id,
        {
          orderItems: order.orderItems,
        },
        // @ts-expect-error // fixme: bad enums
        blApiRequest.user,
      );
    }

    await this.orderPlacedHandler.placeOrder(order, blApiRequest.user?.details ?? "");

    const isAdmin =
      blApiRequest.user?.permission !== undefined &&
      PermissionService.isPermissionEqualOrOver(blApiRequest.user?.permission, "admin");

    await this.orderValidator.validate(order, isAdmin);

    if (!order.byCustomer) {
      try {
        await this.recordStandHandovers(returnOrderItems, handoutOrderItems, order.id);
      } catch (error) {
        // The order is placed; failing it now would tell the employee a completed checkout
        // failed. The missing handover rows only cost match bookkeeping, which an admin can
        // reconcile, so report and move on.
        Sentry.captureException(error);
      }
    }

    if (customerItems && customerItems.length > 0) {
      try {
        // should add customerItems to customer if present
        await this.addCustomerItemsToCustomer(
          customerItems,
          order.customer,
          // @ts-expect-error // fixme: bad enums
          blApiRequest.user,
        );
        // fixme: probably not a good idea to ignore this error...
      } catch {}
    }
    return new BlapiResponse([order]);
  }

  private async addCustomerItems(
    customerItems: CustomerItem[],
    user: { id: string; permission: UserPermission },
  ): Promise<CustomerItem[]> {
    const addedCustomerItems = [];
    for (const customerItem of customerItems) {
      const ci = await StorageService.CustomerItems.add(customerItem, user);
      addedCustomerItems.push(ci);
    }

    return addedCustomerItems;
  }

  private async addCustomerItemsToCustomer(
    customerItems: CustomerItem[],
    customerId: string,
  ): Promise<boolean> {
    const customerItemIds: string[] = customerItems.map((ci) => ci.id.toString());

    const userDetail = await StorageService.UserDetails.get(customerId);

    await StorageService.UserDetails.update(customerId, {
      customerItems: [...userDetail.customerItems, ...customerItemIds],
    });

    return true;
  }

  private addCustomerItemIdToOrderItems(order: Order, customerItems: CustomerItem[]) {
    for (const customerItem of customerItems) {
      for (const orderItem of order.orderItems) {
        if (customerItem.item === orderItem.item) {
          orderItem.customerItem = customerItem.id;
        }
      }
    }
    return order;
  }
}
