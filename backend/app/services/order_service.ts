import { Exception } from "@adonisjs/core/exceptions";
import db from "@adonisjs/lucid/services/db";

import Branch from "#models/branch";
import Item from "#models/item";
import Order from "#models/order";
import type { NewOrderItem } from "#models/order";
import OrderItem from "#models/order_item";
import BadRequestException from "#exceptions/bad_request_exception";
import CustomerItem from "#models/customer_item";
import { itemIdsInActiveUserMatches } from "#services/matches/cancellation_block";
import { OrderItemService } from "#services/order_item_service";
import type { CartItemType, CheckoutCartItem } from "#shared/cart_item";
import { ACQUISITION_CART_ITEM_TYPES } from "#shared/cart_item";
import { OPEN_ORDER_ITEM_TYPES } from "#shared/order/open-order-item";

export const OrderService = {
  async getOpenOrderItems(customerId: string, types: CartItemType[] = ["rent", "partly-payment"]) {
    // The stand's own orders count too: a book moved to another branch or period without a
    // handout is still an open order.
    const lines: {
      orderId: string;
      itemId: string;
      type: CartItemType;
      periodTo: string | null;
      orderAmount: number;
      title: string;
      isbn: string | null;
      branchId: string;
      branchName: string;
    }[] = await OrderItem.openLinesOf(
      customerId,
      OPEN_ORDER_ITEM_TYPES.filter((type) => types.some((wanted) => wanted === type)),
    )
      .join("items", "items.id", "order_items.item_id")
      .join("branches", "branches.id", "orders.branch_id")
      .select(
        "orders.id as orderId",
        "order_items.item_id as itemId",
        "order_items.type",
        "order_items.period_to as periodTo",
        "orders.amount as orderAmount",
        "items.title",
        db.raw("items.isbn::text as isbn"),
        "orders.branch_id as branchId",
        "branches.name as branchName",
      );
    const openOrderItems = lines.map((line) => ({
      orderId: line.orderId,
      itemId: line.itemId,
      type: line.type,
      deadline: line.periodTo ?? "",
      cancelable: line.orderAmount === 0,
      title: line.title,
      isbn: line.isbn,
      branch: { id: line.branchId, name: line.branchName },
    }));

    // An item a user match depends on is never cancelable, regardless of match lock
    const blockedItemIds = await itemIdsInActiveUserMatches(customerId);
    return openOrderItems.map((openOrderItem) => {
      if (blockedItemIds.has(openOrderItem.itemId)) {
        openOrderItem.cancelable = false;
      }
      return openOrderItem;
    });
  },

  /**
   * Builds an unplaced order from cart lines. Orders made at the stand are recorded as the
   * employee's, which is also what lets the payment be settled by card or cash.
   */
  async createFromCart(
    customerId: string,
    cartItems: CheckoutCartItem[],
    placedBy?: { byCustomer: true } | { byCustomer: false; employee: string },
  ) {
    if (new Set(cartItems.map((cartItem) => cartItem.id)).size !== cartItems.length) {
      throw new BadRequestException("Du kan ikke bestille flere av samme bok");
    }

    // Only public branches are orderable online. Extending or buying out a book the customer
    // already has is not ordering from the branch, so those lines are not checked.
    const orderedFrom = await Branch.byIds(
      cartItems
        .filter((cartItem) => ACQUISITION_CART_ITEM_TYPES.includes(cartItem.type))
        .map((cartItem) => cartItem.branchId),
    );
    for (const branch of orderedFrom.values()) {
      if (branch.visibility !== "public") {
        throw new BadRequestException(`Det er ikke mulig å bestille fra ${branch.name}`);
      }
    }

    const openOrderItemIds = cartItems.some((cartItem) =>
      ACQUISITION_CART_ITEM_TYPES.includes(cartItem.type),
    )
      ? new Set(
          (await OrderService.getOpenOrderItems(customerId, ACQUISITION_CART_ITEM_TYPES)).map(
            (row) => row.itemId,
          ),
        )
      : new Set<string>();

    const itemIds = cartItems.map((cartItem) => cartItem.id);
    const [items, heldCopies] = await Promise.all([
      Item.byIds(itemIds),
      CustomerItem.whereActive(
        CustomerItem.query().where("customer_id", customerId).whereIn("item_id", itemIds),
      ),
    ]);
    const heldByItem = new Map(
      heldCopies.map((customerItem) => [customerItem.itemId, customerItem]),
    );

    let total = 0;
    const orderItems: NewOrderItem[] = [];

    for (const cartItem of cartItems) {
      const item = items.get(cartItem.id);
      if (!item) {
        throw new Exception(`Fant ikke boken ${cartItem.id}`, {
          status: 404,
          code: "E_ROW_NOT_FOUND",
        });
      }
      const customerItem = heldByItem.get(cartItem.id) ?? null;
      if (ACQUISITION_CART_ITEM_TYPES.includes(cartItem.type)) {
        if (customerItem) {
          throw new BadRequestException(`Du har allerede «${item.title}»`);
        }
        if (openOrderItemIds.has(cartItem.id)) {
          throw new BadRequestException(`Du har allerede bestilt «${item.title}»`);
        }
      }
      let orderItem: NewOrderItem;
      switch (cartItem.type) {
        case "buyout": {
          if (!customerItem) {
            throw new Error("No customer item found for buyout");
          }
          orderItem = await OrderItemService.createBuyoutOrderItem(customerItem, item);
          break;
        }
        case "extend": {
          if (!customerItem) {
            throw new Error("customerItem is required for extensions");
          }
          if (!cartItem.to) {
            throw new Error("to is required for extensions");
          }
          orderItem = await OrderItemService.createExtendOrderItem(customerItem, item, cartItem.to);
          break;
        }
        case "buy": {
          orderItem = OrderItemService.createBuyOrderItem(item);
          break;
        }
        case "partly-payment": {
          if (!cartItem.to) {
            throw new Error("to is required for extensions");
          }
          orderItem = await OrderItemService.createPartlyPaymentOrderItem(
            item,
            cartItem.branchId,
            cartItem.to,
          );
          break;
        }
        case "rent": {
          if (!cartItem.to) {
            throw new Error("to is required for extensions");
          }
          orderItem = await OrderItemService.createRentOrderItem(
            item,
            cartItem.branchId,
            cartItem.to,
          );
          break;
        }
        default: {
          throw new Error("Order item type not supported");
        }
      }
      total += orderItem.amount;
      orderItems.push(orderItem);
    }
    const branchId = cartItems[0]?.branchId;
    if (!branchId) {
      throw new Error("No branchId for checkout order");
    }

    return Order.createWithItems({
      amount: total,
      orderItems,
      branchId,
      customerId,
      placed: false,
      byCustomer: placedBy?.byCustomer ?? true,
      employeeId: placedBy?.byCustomer === false ? placedBy.employee : null,
    });
  },
};
