import type { HttpContext } from "@adonisjs/core/http";

import { assertNotBlockedByUserMatch } from "#services/matches/cancellation_block";
import { OrderCancellationService } from "#services/order_cancellation_service";
import { OrderHistoryService } from "#services/order_history_service";
import { OrderManagerService } from "#services/order_manager_service";
import { OrderService } from "#services/order_service";
import { StorageService } from "#services/storage_service";
import type { Order } from "#shared/order/order";
import type { OrderItem } from "#shared/order/order-item/order-item";
import { cancelOrderItemValidator } from "#validators/cancel_order_item_validator";
import {
  orderBranchUpdateValidator,
  orderItemDeadlineUpdateValidator,
} from "#validators/order_history";
import {
  orderManagerBringReportValidator,
  orderManagerListValidator,
  orderManagerReportValidator,
} from "#validators/order_manager";
import { SEDbQuery } from "#models/mongoose/storage/db-query";
import { monitoredEmployee } from "#services/employee_monitoring_service";

function findOpenOrderItem(order: Order, itemId: string) {
  return order.orderItems.find(
    (orderItem: OrderItem) =>
      orderItem.item === itemId && !orderItem.movedToOrder && !orderItem.movedFromOrder,
  );
}

/**
 * Orders as seen by employees (`/orders`, `/users/:detailsId/orders`) and by the
 * customer themselves (`/orders/me`).
 */
export default class OrdersController {
  /** Open orders across branches, for Ordreoversikt. */
  async index(ctx: HttpContext) {
    const { branchIds, bringOnly, cursor, limit } =
      await ctx.request.validateUsing(orderManagerListValidator);
    return OrderManagerService.listOpenOrders({ branchIds, bringOnly }, cursor, limit);
  }

  async show(ctx: HttpContext) {
    return OrderManagerService.getOrder(String(ctx.request.param("orderId")));
  }

  async export(ctx: HttpContext) {
    const { branchIds, bringOnly } = await ctx.request.validateUsing(orderManagerReportValidator);
    return OrderManagerService.ordersReport({ branchIds, bringOnly });
  }

  async exportBring(ctx: HttpContext) {
    const { branchIds, bringOnly, parcelType } = await ctx.request.validateUsing(
      orderManagerBringReportValidator,
    );
    return OrderManagerService.bringReport({ branchIds, bringOnly }, parcelType);
  }

  async updateBranch(ctx: HttpContext) {
    const orderId = ctx.request.param("orderId");
    const { branchId } = await ctx.request.validateUsing(orderBranchUpdateValidator);
    await OrderHistoryService.updateBranch(
      orderId,
      branchId,
      monitoredEmployee(ctx.auth.getUserOrFail()),
    );
    return ctx.response.noContent();
  }

  async updateItemDeadline(ctx: HttpContext) {
    const orderId = ctx.request.param("orderId");
    const { itemId, deadline } = await ctx.request.validateUsing(orderItemDeadlineUpdateValidator);
    await OrderHistoryService.updateItemDeadline(
      { orderId, itemId, deadline },
      monitoredEmployee(ctx.auth.getUserOrFail()),
    );
    return ctx.response.noContent();
  }

  async destroy(ctx: HttpContext) {
    await OrderHistoryService.deleteOrder(
      ctx.request.param("orderId"),
      monitoredEmployee(ctx.auth.getUserOrFail()),
    );
    return ctx.response.noContent();
  }

  /** The order history of a given customer, for the employee view. */
  async forCustomer(ctx: HttpContext) {
    return OrderHistoryService.getForCustomer(ctx.request.param("detailsId"), "employee");
  }

  /** Every placed order of a given customer, as stored. */
  async placedForCustomer(ctx: HttpContext) {
    const databaseQuery = new SEDbQuery();
    databaseQuery.booleanFilters = [{ fieldName: "placed", value: true }];
    databaseQuery.stringFilters = [
      { fieldName: "customer", value: ctx.request.param("detailsId") },
    ];
    return (await StorageService.Orders.getByQueryOrNull(databaseQuery)) ?? [];
  }

  async indexMe(ctx: HttpContext) {
    return OrderHistoryService.getForCustomer(ctx.auth.getUserOrFail().id, "customer");
  }

  async showMe(ctx: HttpContext) {
    return OrderHistoryService.getOne(
      ctx.request.param("orderId"),
      ctx.auth.getUserOrFail().id,
      "customer",
    );
  }

  /** Order items the customer has ordered but not yet received. */
  async openItemsMe(ctx: HttpContext) {
    return OrderService.getOpenOrderItems(ctx.auth.getUserOrFail().id);
  }

  async cancelItemMe(ctx: HttpContext) {
    const { id: detailsId } = ctx.auth.getUserOrFail();
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
}
