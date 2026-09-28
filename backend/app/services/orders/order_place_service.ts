import db from "@adonisjs/lucid/services/db";
import * as Sentry from "@sentry/node";
import { DateTime } from "luxon";

import CustomerItem from "#models/customer_item";
import Order from "#models/order";
import type OrderItem from "#models/order_item";
import { OrderToCustomerItemGenerator } from "#services/customer_items/order_to_customer_item_generator";
import { MatchRepository } from "#services/matches/match_repository";
import { OrderPlacedHandler } from "#services/orders/order_placed_handler";
import { OrderValidator } from "#services/orders/validation/order_validator";
import { isNotNullish } from "#services/typescript_helpers";
import { BlError } from "#shared/bl-error";
import type { OrderItemType } from "#shared/order/order-item/order-item-type";
import type { UserPermission } from "#shared/user-permission";
import { hasPermissionLevel } from "#shared/user-permission";

/** The user placing the order: the employee at the stand, or the customer for their own order. */
interface PlacingUser {
  id: string;
  permission: UserPermission;
}

/**
 * Places a stored order: generates the customer items it hands out, marks it placed, validates it
 * and records the books it moved between the stand and the customer.
 */
export class OrderPlaceService {
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

  /** Whether the customer already ordered one of the order's books with the same deadline. */
  private async hasOpenOrderWithOrderItems(order: Order) {
    const lines = order.orderItems.flatMap(({ itemId, periodTo }) => {
      const deadline = periodTo?.toISODate();
      return deadline ? [{ itemId, periodTo: deadline }] : [];
    });
    if (order.customerId === null || lines.length === 0) {
      return false;
    }
    const match = await db
      .from("order_items")
      .join("orders", "orders.id", "order_items.order_id")
      .where("orders.customer_id", order.customerId)
      .where("orders.placed", true)
      .where("orders.by_customer", true)
      .where("order_items.handout", false)
      .whereNull("order_items.moved_to_order_id")
      .whereIn("order_items.type", ["rent", "buy", "partly-payment"])
      .where((query) => {
        for (const { itemId, periodTo } of lines) {
          void query.orWhere((line) =>
            line.where("order_items.item_id", itemId).where("order_items.period_to", periodTo),
          );
        }
      })
      .select("order_items.id")
      .first();
    return match !== null;
  }

  /**
   * Check whether a blid in the order is already handed out
   *
   * Unable to check against old customer items which have no blid, but there
   * are very few of those which are not returned. Only checks whether a blid is
   * already handed out if the handout order type of the item in this order is
   * "buy", "rent" or "partly-payment".
   *
   * @param order The Order which contains items
   * @private
   */
  private async isSomeBlidAlreadyHandedOut(order: Order): Promise<boolean> {
    const handoutOrderTypes = new Set<OrderItemType>(["buy", "rent", "partly-payment"]);
    const blids = order.orderItems
      .filter((orderItem) => handoutOrderTypes.has(orderItem.type))
      .map((orderItem) => orderItem.blid)
      .filter(isNotNullish);
    if (blids.length === 0) {
      return false;
    }

    // In some cases, books that have previously been bought out get returned
    // to Boklistens possesion without being registered as a buyback
    // Therefore, it should be possible to hand out books that have been bought out
    const unreturned = await db
      .from("customer_items")
      .whereIn("blid", blids)
      .where("returned", false)
      .where("buyout", false)
      .select("id")
      .first();
    return unreturned !== null;
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
      CustomerItem.findByIds(returnOrderItems.map((orderItem) => orderItem.customerItemId)),
      CustomerItem.findByIds(handoutOrderItems.map((orderItem) => orderItem.customerItemId)),
    ]);

    for (const customerItem of returnCustomerItems) {
      if (customerItem.customerId === null) {
        continue;
      }
      const obligation = await MatchRepository.findSenderObligation(
        customerItem.customerId,
        customerItem.itemId,
      );
      await MatchRepository.recordHandover({
        blid: customerItem.blid,
        itemId: customerItem.itemId,
        fromUserDetailId: customerItem.customerId,
        toUserDetailId: null,
        occurredAt: DateTime.now(),
        orderId,
        dischargesSenderObligationId: obligation?.id ?? null,
        dischargesReceiverObligationId: null,
      });
    }

    for (const customerItem of handoutCustomerItems) {
      if (customerItem.customerId === null) {
        continue;
      }
      const obligation = await MatchRepository.findReceiverObligation(
        customerItem.customerId,
        customerItem.itemId,
      );
      await MatchRepository.recordHandover({
        blid: customerItem.blid,
        itemId: customerItem.itemId,
        fromUserDetailId: null,
        toUserDetailId: customerItem.customerId,
        occurredAt: DateTime.now(),
        orderId,
        dischargesSenderObligationId: null,
        dischargesReceiverObligationId: obligation?.id ?? null,
      });
    }
  }

  /**
   * Places the order with the given id.
   * @returns the placed order
   * @throws ReferenceError if the order does not exist
   * @throws BlError if the order cannot be placed
   */
  public async place(orderId: string, user?: PlacingUser): Promise<Order> {
    const order = await Order.find(orderId);
    if (order === null) {
      throw new ReferenceError(`order "${orderId}" not found`);
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

    const customerItems = await this.orderToCustomerItemGenerator.createFor(order);
    if (customerItems.length > 0) {
      await order.saveWithItems();
    }

    await this.orderPlacedHandler.placeOrder(order, user?.id ?? "");

    const isAdmin = user?.permission !== undefined && hasPermissionLevel(user.permission, "admin");

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

    return order;
  }
}
