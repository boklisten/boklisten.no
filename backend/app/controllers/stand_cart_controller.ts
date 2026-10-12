import type { HttpContext } from "@adonisjs/core/http";

import { StandCartCheckoutService } from "#services/stand_cart/stand_cart_checkout_service";
import { StandCartLineResolver } from "#services/stand_cart/stand_cart_line_resolver";
import {
  standCartCheckoutValidator,
  standCartRefundPlanValidator,
  standCartResolveValidator,
} from "#validators/stand_cart";
import { monitoredEmployee } from "#services/employee_monitoring_service";
import NotFoundException from "#exceptions/not_found_exception";
import { BranchScope } from "#services/branch_scope";

/** The stand order of the route: one in the caller's scope (by branch or customer), else unknown. */
async function orderIdInScope(ctx: HttpContext): Promise<string> {
  const orderId = String(ctx.request.param("orderId"));
  if ((await BranchScope.findOrderInScope(ctx.auth.getUserOrFail(), orderId)) === null) {
    throw new NotFoundException(`Fant ikke ordre ${orderId}`);
  }
  return orderId;
}

/** The stand serves the customers in the employee's scope; anyone else is "no customer". */
export default class StandCartController {
  async resolveLine(ctx: HttpContext) {
    const request = await ctx.request.validateUsing(standCartResolveValidator);
    await BranchScope.assertCustomerInScope(ctx.auth.getUserOrFail(), request.customerId);
    return StandCartLineResolver.resolve(request);
  }

  async refundPlan(ctx: HttpContext) {
    const request = await ctx.request.validateUsing(standCartRefundPlanValidator);
    await BranchScope.assertCustomerInScope(ctx.auth.getUserOrFail(), request.customerId);
    return StandCartCheckoutService.refundPlan(request);
  }

  async checkout(ctx: HttpContext) {
    const employee = monitoredEmployee(ctx.auth.getUserOrFail());
    const request = await ctx.request.validateUsing(standCartCheckoutValidator);
    await BranchScope.assertCustomerInScope(employee, request.customerId);
    return StandCartCheckoutService.checkout(request, employee);
  }

  async status(ctx: HttpContext) {
    return StandCartCheckoutService.status(await orderIdInScope(ctx));
  }

  async cancel(ctx: HttpContext) {
    return StandCartCheckoutService.cancel(await orderIdInScope(ctx));
  }
}
