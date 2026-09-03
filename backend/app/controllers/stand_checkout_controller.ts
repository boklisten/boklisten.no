import type { HttpContext } from "@adonisjs/core/http";

import BadRequestException from "#exceptions/bad_request_exception";
import { PermissionService } from "#services/permission_service";
import { StandCheckoutService } from "#services/stand_checkout_service";
import type { StandCheckoutAction, StandPayment } from "#services/stand_checkout_service";
import { startStandCheckoutValidator } from "#validators/stand_checkout";

export default class StandCheckoutController {
  async start(ctx: HttpContext) {
    const { detailsId } = PermissionService.employeeOrFail(ctx);
    const { customerItemId, action, payment } = await ctx.request.validateUsing(
      startStandCheckoutValidator,
    );

    let standAction: StandCheckoutAction;
    if (action.type === "extend") {
      if (!action.to) {
        throw new BadRequestException("Velg hvilken dato boka skal forlenges til");
      }
      standAction = { type: "extend", to: action.to };
    } else {
      standAction = { type: "buyout" };
    }

    let standPayment: StandPayment;
    if (payment.method === "vipps") {
      if (!payment.phoneNumber) {
        throw new BadRequestException("Telefonnummer mangler");
      }
      standPayment = { method: "vipps", phoneNumber: payment.phoneNumber };
    } else {
      standPayment = { method: "card" };
    }

    return StandCheckoutService.start({
      customerItemId,
      action: standAction,
      payment: standPayment,
      employeeDetailsId: detailsId,
    });
  }

  async status(ctx: HttpContext) {
    PermissionService.employeeOrFail(ctx);
    return StandCheckoutService.status(String(ctx.request.param("orderId")));
  }

  async cancel(ctx: HttpContext) {
    PermissionService.employeeOrFail(ctx);
    return StandCheckoutService.cancel(String(ctx.request.param("orderId")));
  }
}
