import type { HttpContext } from "@adonisjs/core/http";

import { OrderHistoryService } from "#services/order_history_service";
import { PermissionService } from "#services/permission_service";
import { orderBranchUpdateValidator } from "#validators/order_history";

export default class OrderHistoryController {
  async getMyOrder(ctx: HttpContext) {
    const { detailsId } = PermissionService.authenticate(ctx);
    const orderId = ctx.request.param("orderId");
    return OrderHistoryService.getOne(orderId, detailsId, "customer");
  }

  async getMyOrders(ctx: HttpContext) {
    const { detailsId } = PermissionService.authenticate(ctx);
    return OrderHistoryService.getForCustomer(detailsId, "customer");
  }

  async getForCustomer(ctx: HttpContext) {
    PermissionService.employeeOrFail(ctx);
    const detailsId = ctx.request.param("detailsId");
    return OrderHistoryService.getForCustomer(detailsId, "employee");
  }

  async updateBranch(ctx: HttpContext) {
    PermissionService.adminOrFail(ctx);
    const orderId = ctx.request.param("orderId");
    const { branchId } = await ctx.request.validateUsing(orderBranchUpdateValidator);
    await OrderHistoryService.updateBranch(orderId, branchId);
    return ctx.response.noContent();
  }
}
