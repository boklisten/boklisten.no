import type { HttpContext } from "@adonisjs/core/http";

import { SEDbQuery } from "#services/legacy/query/se.db-query";
import { PermissionService } from "#services/permission_service";
import { StorageService } from "#services/storage_service";
import { TranslationService } from "#services/translation_service";
import type { Order } from "#shared/order/order";

async function toPresent(order: Order) {
  const branch = await StorageService.Branches.getOrNull(order.branch);
  const payments = (
    await Promise.all(
      (order.payments ?? []).map((payment) => StorageService.Payments.getOrNull(payment)),
    )
  )
    .filter((payment) => payment !== null)
    .map((payment) => ({
      id: payment.id,
      methodLabel: TranslationService.translatePaymentMethod(payment.method),
      amount: payment.amount,
      confirmed: payment.confirmed,
    }));

  return {
    ...order,
    orderItems: order.orderItems.map((orderItem) => ({
      ...orderItem,
      typeLabel: TranslationService.translateOrderItemTypePastTense(orderItem.type),
    })),
    branchName: branch?.name,
    payments,
  };
}

export default class OrderHistoryController {
  async getMyOrder(ctx: HttpContext) {
    const { detailsId } = PermissionService.authenticate(ctx);
    const orderId = ctx.request.param("orderId");
    const order = await StorageService.Orders.getOrNull(orderId);
    if (!order || detailsId !== order.customer) {
      return null;
    }

    return toPresent(order);
  }
  async getMyOrders(ctx: HttpContext) {
    const { detailsId } = PermissionService.authenticate(ctx);
    const databaseQuery = new SEDbQuery();
    databaseQuery.objectIdFilters = [{ fieldName: "customer", value: detailsId }];
    databaseQuery.booleanFilters = [{ fieldName: "placed", value: true }];
    databaseQuery.sortFilters = [{ fieldName: "creationTime", direction: -1 }];
    const orders = (await StorageService.Orders.getByQueryOrNull(databaseQuery)) ?? [];
    return await Promise.all(orders.map(async (order) => toPresent(order)));
  }
}
