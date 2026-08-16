import { HttpContext } from "@adonisjs/core/http";
import { ObjectId } from "mongodb";

import { OrderCancellationService } from "#services/order_cancellation_service";
import { PermissionService } from "#services/permission_service";
import { StorageService } from "#services/storage_service";
import { OrderItem } from "#shared/order/order-item/order-item";
import { cancelOrderItemValidator } from "#validators/cancel_order_item_validator";
import { SEDbQuery } from "#services/legacy/query/se.db-query";

export default class OrdersController {
  async getOpenOrders(ctx: HttpContext) {
    const { detailsId } = PermissionService.authenticate(ctx);

    return (await StorageService.Orders.aggregate([
      {
        $match: {
          customer: new ObjectId(detailsId),
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
          "orderItems.type": { $in: ["rent", "partly-payment"] },
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
  }

  async getPlacedOrders(ctx: HttpContext) {
    PermissionService.employeeOrFail(ctx);
    const detailsId = ctx.request.param("detailsId");
    const databaseQuery = new SEDbQuery();
    databaseQuery.booleanFilters = [
      {
        fieldName: "placed",
        value: true,
      },
    ];
    databaseQuery.stringFilters = [
      {
        fieldName: "customer",
        value: detailsId,
      },
    ];
    return await StorageService.Orders.getByQuery(databaseQuery);
  }

  async cancelOrderItem(ctx: HttpContext) {
    const { detailsId } = PermissionService.authenticate(ctx);
    const { orderId, itemId } = await ctx.request.validateUsing(cancelOrderItemValidator);
    const order = await StorageService.Orders.get(orderId);
    if (!order || order.customer !== detailsId) {
      return ctx.response.notFound();
    }
    const findOrderItem = (oi: OrderItem) =>
      oi.item === itemId && !oi.movedToOrder && !oi.movedFromOrder;
    const orderItem = order.orderItems.find(findOrderItem);

    if (!orderItem) {
      return ctx.response.notFound();
    }

    return OrderCancellationService.cancelOrderItems({
      originalOrder: order,
      orderItems: [{ item: itemId, title: orderItem.title }],
      notifyCustomer: true,
    });
  }
}
