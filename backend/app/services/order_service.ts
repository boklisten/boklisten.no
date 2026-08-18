import { ObjectId } from "mongodb";

import BadRequestException from "#exceptions/bad_request_exception";
import { CustomerItemService } from "#services/customer_item_service";
import { itemIdsInActiveUserMatches } from "#services/matches/cancellation_block";
import { OrderItemService } from "#services/order_item_service";
import { StorageService } from "#services/storage_service";
import { ACQUISITION_CART_ITEM_TYPES, CartItemType, CheckoutCartItem } from "#shared/cart_item";
import { OrderItem } from "#shared/order/order-item/order-item";

export const OrderService = {
  async getOpenOrderItems(customerId: string, types: CartItemType[] = ["rent", "partly-payment"]) {
    const openOrderItems = (await StorageService.Orders.aggregate([
      {
        $match: {
          customer: new ObjectId(customerId),
          placed: true,
          byCustomer: true,
        },
      },
      {
        $unwind: {
          path: "$orderItems",
        },
      },
      {
        $match: {
          "orderItems.type": { $in: types },
          "orderItems.movedToOrder": null,
          "orderItems.movedFromOrder": null,
        },
      },
      {
        $lookup: {
          from: "items",
          localField: "orderItems.item",
          foreignField: "_id",
          as: "item",
        },
      },
      {
        $unwind: {
          path: "$item",
        },
      },
      {
        $project: {
          orderId: "$_id",
          itemId: "$orderItems.item",
          title: "$item.title",
          deadline: "$orderItems.info.to",
          cancelable: { $eq: ["$amount", 0] },
        },
      },
    ])) as {
      orderId: string;
      itemId: string;
      title: string;
      deadline: string;
      cancelable: boolean;
    }[];

    // An item a user match depends on is never cancelable, regardless of match lock
    const blockedItemIds = await itemIdsInActiveUserMatches(customerId);
    return openOrderItems.map((openOrderItem) =>
      blockedItemIds.has(String(openOrderItem.itemId))
        ? { ...openOrderItem, cancelable: false }
        : openOrderItem,
    );
  },

  async createFromCart(customerId: string, cartItems: CheckoutCartItem[]) {
    if (new Set(cartItems.map((cartItem) => cartItem.id)).size !== cartItems.length)
      throw new BadRequestException("Du kan ikke bestille flere av samme bok");

    const openOrderItemIds = cartItems.some((cartItem) =>
      ACQUISITION_CART_ITEM_TYPES.includes(cartItem.type),
    )
      ? new Set(
          (await OrderService.getOpenOrderItems(customerId, ACQUISITION_CART_ITEM_TYPES)).map(
            (row) => String(row.itemId),
          ),
        )
      : new Set<string>();

    let total = 0;
    const orderItems: OrderItem[] = [];

    for (const cartItem of cartItems) {
      const [item, customerItem] = await Promise.all([
        StorageService.Items.get(cartItem.id),
        CustomerItemService.getCustomerItemByItemIdOrNull({
          customerId,
          itemId: cartItem.id,
        }),
      ]);
      if (ACQUISITION_CART_ITEM_TYPES.includes(cartItem.type)) {
        if (customerItem) throw new BadRequestException(`Du har allerede «${item.title}»`);
        if (openOrderItemIds.has(cartItem.id))
          throw new BadRequestException(`Du har allerede bestilt «${item.title}»`);
      }
      let orderItem: OrderItem;
      switch (cartItem.type) {
        case "buyout": {
          if (!customerItem) throw new Error("No customer item found for buyout");
          orderItem = await OrderItemService.createBuyoutOrderItem(customerItem, item);
          break;
        }
        case "extend": {
          if (!customerItem) throw new Error("customerItem is required for extensions");
          if (!cartItem.to) throw new Error("to is required for extensions");
          orderItem = await OrderItemService.createExtendOrderItem(customerItem, item, cartItem.to);
          break;
        }
        case "buy": {
          orderItem = OrderItemService.createBuyOrderItem(item);
          break;
        }
        case "partly-payment": {
          if (!cartItem.to) throw new Error("to is required for extensions");
          orderItem = await OrderItemService.createPartlyPaymentOrderItem(
            item,
            cartItem.branchId,
            cartItem.to,
          );
          break;
        }
        case "rent": {
          if (!cartItem.to) throw new Error("to is required for extensions");
          orderItem = await OrderItemService.createRentOrderItem(
            item,
            cartItem.branchId,
            cartItem.to,
          );
          break;
        }
        default:
          throw new Error("Order item type not supported");
      }
      total += orderItem.amount;
      orderItems.push(orderItem);
    }
    const branchId = cartItems[0]?.branchId;
    if (!branchId) throw new Error("No branchId for checkout order");

    return await StorageService.Orders.add({
      amount: total,
      orderItems,
      branch: branchId,
      customer: customerId,
      placed: false,
      byCustomer: true,
    });
  },
};
