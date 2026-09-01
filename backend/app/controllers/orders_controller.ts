import type { HttpContext } from "@adonisjs/core/http";

import BadRequestException from "#exceptions/bad_request_exception";
import { assertNotBlockedByUserMatch } from "#services/matches/cancellation_block";
import { OrderCancellationService } from "#services/order_cancellation_service";
import { OrderService } from "#services/order_service";
import { PermissionService } from "#services/permission_service";
import { StorageService } from "#services/storage_service";
import type { Order } from "#shared/order/order";
import type { OrderItem } from "#shared/order/order-item/order-item";
import { USER_PERMISSION } from "#shared/user-permission";
import { cancelOrderItemValidator } from "#validators/cancel_order_item_validator";
import { SEDbQuery } from "#services/legacy/query/se.db-query";

function findOpenOrderItem(order: Order, itemId: string) {
  return order.orderItems.find(
    (orderItem: OrderItem) =>
      orderItem.item === itemId && !orderItem.movedToOrder && !orderItem.movedFromOrder,
  );
}

export default class OrdersController {
  async getOpenOrders(ctx: HttpContext) {
    const { detailsId } = PermissionService.authenticate(ctx);

    return await OrderService.getOpenOrderItems(detailsId);
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
    return (await StorageService.Orders.getByQueryOrNull(databaseQuery)) ?? [];
  }

  async cancelOrderItem(ctx: HttpContext) {
    const { detailsId } = PermissionService.authenticate(ctx);
    const { orderId, itemId } = await ctx.request.validateUsing(cancelOrderItemValidator);
    const order = await StorageService.Orders.get(orderId);
    if (!order || order.customer !== detailsId) {
      return ctx.response.notFound();
    }
    const orderItem = findOpenOrderItem(order, itemId);
    if (!orderItem) {
      return ctx.response.notFound();
    }

    await assertNotBlockedByUserMatch(order.customer, itemId);

    return OrderCancellationService.cancelOrderItems({
      originalOrder: order,
      orderItems: [{ item: itemId, title: orderItem.title }],
      notifyCustomer: true,
    });
  }

  async cancelOrderItemAsEmployee(ctx: HttpContext) {
    const { detailsId: employeeDetailsId } = PermissionService.authenticate(
      ctx,
      USER_PERMISSION.EMPLOYEE,
    );
    const { orderId, itemId } = await ctx.request.validateUsing(cancelOrderItemValidator);
    const order = await StorageService.Orders.get(orderId);
    if (!order) {
      return ctx.response.notFound();
    }
    const orderItem = findOpenOrderItem(order, itemId);
    if (!orderItem) {
      return ctx.response.notFound();
    }

    if (order.amount !== 0) {
      throw new BadRequestException("Bestillingen er betalt og kan ikke avbestilles her.");
    }

    await assertNotBlockedByUserMatch(order.customer, itemId);

    return OrderCancellationService.cancelOrderItems({
      originalOrder: order,
      orderItems: [{ item: itemId, title: orderItem.title }],
      employeeDetailsId,
      notifyCustomer: true,
    });
  }
}
