import type { HttpContext } from "@adonisjs/core/http";

import { StandCartCheckoutService } from "#services/stand_cart/stand_cart_checkout_service";
import { StandCartLineResolver } from "#services/stand_cart/stand_cart_line_resolver";
import {
  standCartCheckoutValidator,
  standCartRefundPlanValidator,
  standCartResolveValidator,
} from "#validators/stand_cart";

export default class StandCartController {
  async resolveLine(ctx: HttpContext) {
    const request = await ctx.request.validateUsing(standCartResolveValidator);
    return StandCartLineResolver.resolve(request);
  }

  async refundPlan(ctx: HttpContext) {
    const request = await ctx.request.validateUsing(standCartRefundPlanValidator);
    return StandCartCheckoutService.refundPlan(request);
  }

  async checkout(ctx: HttpContext) {
    const employee = ctx.authUser;
    const request = await ctx.request.validateUsing(standCartCheckoutValidator);
    return StandCartCheckoutService.checkout(request, employee);
  }

  async status(ctx: HttpContext) {
    return StandCartCheckoutService.status(String(ctx.request.param("orderId")));
  }

  async cancel(ctx: HttpContext) {
    return StandCartCheckoutService.cancel(String(ctx.request.param("orderId")));
  }
}
