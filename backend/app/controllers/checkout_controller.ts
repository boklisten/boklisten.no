import type { HttpContext } from "@adonisjs/core/http";

import Branch from "#models/branch";
import Order from "#models/order";
import UnauthorizedException from "#exceptions/unauthorized_exception";
import { OrderPlacedHandler } from "#services/orders/order_placed_handler";
import { OrderService } from "#services/order_service";
import { assertSignedForCheckout } from "#services/signature_helper";
import { VippsCheckoutService } from "#services/vipps/vipps_checkout_service";
import { VippsPaymentService } from "#services/vipps/vipps_payment_service";
import {
  initializeCheckoutValidator,
  vippsCheckoutSessionValidator,
} from "#validators/checkout_validators";

export default class CheckoutController {
  async initialize(ctx: HttpContext) {
    const user = ctx.auth.getUserOrFail();
    const { cartItems } = await ctx.request.validateUsing(initializeCheckoutValidator);
    await assertSignedForCheckout(user, cartItems);
    const order = await OrderService.createFromCart(user.id, cartItems);
    const branch = await Branch.findOrFail(order.branchId);
    const isDeliveryFree = branch.responsibleForDelivery;

    if (order.amount === 0 && (!branch.deliveryByMail || isDeliveryFree)) {
      return { nextStep: "confirm", orderId: order.id } as const;
    }

    const { token, checkoutFrontendUrl } = await VippsCheckoutService.create(order, isDeliveryFree);
    return { nextStep: "payment", token, checkoutFrontendUrl } as const;
  }
  async confirm(ctx: HttpContext) {
    const { id: userId } = ctx.auth.getUserOrFail();
    const orderId = String(ctx.request.param("orderId"));
    await Order.whileLocked(orderId, async () => {
      const order = await Order.getOrFail(orderId);
      if (userId !== order.customerId || order.checkoutState || order.amount > 0) {
        throw new Error("You do not have permission to confirm this order");
      }
      if (!order.placed) {
        await new OrderPlacedHandler().placeOrder(order, userId);
      }
    });
  }

  async vippsCallback(ctx: HttpContext) {
    if (!VippsPaymentService.token.verify(ctx.request.header("Authorization") ?? "")) {
      throw new UnauthorizedException("Authorization header missing or invalid");
    }
    const session = await ctx.request.validateUsing(vippsCheckoutSessionValidator);
    await VippsCheckoutService.update(session);
  }

  async status(ctx: HttpContext) {
    const { id: userId } = ctx.auth.getUserOrFail();
    const orderId = ctx.request.param("orderId");
    const order = await Order.getOrFail(orderId);
    if (userId !== order.customerId) {
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
