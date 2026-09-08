import type { HttpContext } from "@adonisjs/core/http";

import { PermissionService } from "#services/permission_service";
import { StandCartCheckoutService } from "#services/stand_cart/stand_cart_checkout_service";
import { StandCartLineResolver } from "#services/stand_cart/stand_cart_line_resolver";
import { standCartCheckoutValidator, standCartResolveValidator } from "#validators/stand_cart";

export default class StandCartController {
  async resolveLine(ctx: HttpContext) {
    PermissionService.employeeOrFail(ctx);
    const request = await ctx.request.validateUsing(standCartResolveValidator);
    return StandCartLineResolver.resolve(request);
  }

  async checkout(ctx: HttpContext) {
    const employee = PermissionService.employeeOrFail(ctx);
    const request = await ctx.request.validateUsing(standCartCheckoutValidator);
    return StandCartCheckoutService.checkout(request, employee);
  }

  async status(ctx: HttpContext) {
    PermissionService.employeeOrFail(ctx);
    return StandCartCheckoutService.status(String(ctx.request.param("orderId")));
  }

  async cancel(ctx: HttpContext) {
    PermissionService.employeeOrFail(ctx);
    return StandCartCheckoutService.cancel(String(ctx.request.param("orderId")));
  }
}
