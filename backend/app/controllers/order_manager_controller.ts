import type { HttpContext } from "@adonisjs/core/http";

import { OrderManagerService } from "#services/order_manager_service";
import { PermissionService } from "#services/permission_service";
import {
  orderManagerBringReportValidator,
  orderManagerListValidator,
  orderManagerReportValidator,
} from "#validators/order_manager";

export default class OrderManagerController {
  async listOpenOrders(ctx: HttpContext) {
    PermissionService.employeeOrFail(ctx);
    const { branchIds, bringOnly, cursor, limit } =
      await ctx.request.validateUsing(orderManagerListValidator);
    return OrderManagerService.listOpenOrders({ branchIds, bringOnly }, cursor, limit);
  }

  async getOrder(ctx: HttpContext) {
    PermissionService.employeeOrFail(ctx);
    return OrderManagerService.getOrder(String(ctx.request.param("orderId")));
  }

  async ordersReport(ctx: HttpContext) {
    PermissionService.employeeOrFail(ctx);
    const { branchIds, bringOnly } = await ctx.request.validateUsing(orderManagerReportValidator);
    return OrderManagerService.ordersReport({ branchIds, bringOnly });
  }

  async bringReport(ctx: HttpContext) {
    PermissionService.employeeOrFail(ctx);
    const { branchIds, bringOnly, parcelType } = await ctx.request.validateUsing(
      orderManagerBringReportValidator,
    );
    return OrderManagerService.bringReport({ branchIds, bringOnly }, parcelType);
  }
}
