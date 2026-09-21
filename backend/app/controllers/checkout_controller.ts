import type { HttpContext } from "@adonisjs/core/http";

import Branch from "#models/branch";
import User from "#models/user";
import UnauthorizedException from "#exceptions/unauthorized_exception";
import { OrderPlacedHandler } from "#services/orders/order_placed_handler";
import { OrderService } from "#services/order_service";
import { assertSignedForCheckout } from "#services/signature_helper";
import { StorageService } from "#services/storage_service";
import { VippsCheckoutService } from "#services/vipps/vipps_checkout_service";
import { VippsPaymentService } from "#services/vipps/vipps_payment_service";
import {
  initializeCheckoutValidator,
  vippsCheckoutSessionValidator,
} from "#validators/checkout_validators";

export default class CheckoutController {
  async initialize(ctx: HttpContext) {
    const { id: detailsId } = ctx.auth.getUserOrFail();
    const { cartItems } = await ctx.request.validateUsing(initializeCheckoutValidator);
    await assertSignedForCheckout(await User.findOrFail(detailsId), cartItems);
    const order = await OrderService.createFromCart(detailsId, cartItems);
    const branch = await Branch.findOrFail(order.branch);
    const isDeliveryFree = branch.responsibleForDelivery;

    if (order.amount === 0 && (!branch.deliveryByMail || isDeliveryFree)) {
      return { nextStep: "confirm", orderId: order.id } as const;
    }

    const { token, checkoutFrontendUrl } = await VippsCheckoutService.create(order, isDeliveryFree);
    return { nextStep: "payment", token, checkoutFrontendUrl } as const;
  }
  async confirm(ctx: HttpContext) {
    const { id: detailsId } = ctx.auth.getUserOrFail();
    const orderId = ctx.request.param("orderId");
    const order = await StorageService.Orders.get(orderId);
    if (detailsId !== order.customer || order.checkoutState || order.amount > 0) {
      throw new Error("You do not have permission to confirm this order");
    }

    await new OrderPlacedHandler().placeOrder(order, order.customer);
  }

  async vippsCallback(ctx: HttpContext) {
    if (!VippsPaymentService.token.verify(ctx.request.header("Authorization") ?? "")) {
      throw new UnauthorizedException("Authorization header missing or invalid");
    }
    const session = await ctx.request.validateUsing(vippsCheckoutSessionValidator);
    await VippsCheckoutService.update(session);
  }

  async status(ctx: HttpContext) {
    const { id: detailsId } = ctx.auth.getUserOrFail();
    const orderId = ctx.request.param("orderId");
    const order = await StorageService.Orders.get(orderId);
    if (detailsId !== order.customer) {
      throw new Error("You do not have permission to access this payment information");
    }

    if (order.checkoutState === "SessionCreated" || order.checkoutState === "PaymentInitiated") {
      const session = await VippsPaymentService.checkout.info(order.id);
      await VippsCheckoutService.update(session);
      return session.sessionState;
    }

    return order.checkoutState ?? null;
  }
}
