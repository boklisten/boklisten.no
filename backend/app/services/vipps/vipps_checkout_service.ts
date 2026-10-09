import * as Sentry from "@sentry/node";
import { DateTime } from "luxon";

import Branch from "#models/branch";
import Delivery from "#models/delivery";
import Order from "#models/order";
import Payment from "#models/payment";
import User from "#models/user";
import { deliveryDays } from "#services/application_config";
import { BringService } from "#services/bring/bring_service";
import { DeliveryService } from "#services/delivery_service";
import { OrderPlacedHandler } from "#services/orders/order_placed_handler";
import { TranslationService } from "#services/translation_service";
import { VippsPaymentService } from "#services/vipps/vipps_payment_service";
import { clientOrigin } from "#config/app";
import env from "#start/env";
import type { VippsCheckoutSession } from "#validators/checkout_validators";

async function createLogistics(order: Order, isDeliveryFree: boolean) {
  const needLogistics = order.orderItems.some(
    (orderItem) =>
      orderItem.type === "rent" || orderItem.type === "partly-payment" || orderItem.type === "buy",
  );
  if (!needLogistics) {
    return null;
  }

  const totalWeightInGrams = DeliveryService.calculateOrderWeightInGrams(order);

  const needPickupPoint = !DeliveryService.isPostal(totalWeightInGrams, order.orderItems.length);

  const deliveryPrice = Math.ceil((totalWeightInGrams / 1000) * 20) + (needPickupPoint ? 150 : 75);

  const branch = await Branch.findOrFail(order.branchId);
  return {
    fixedOptions: [
      ...(order.amount > 0 && branch.deliveryAtBranch
        ? [
            {
              id: "pickup",
              amount: {
                value: 0,
                currency: "NOK",
              },
              brand: "OTHER",
              title: "Hent selv på stand",
              description: "Du finner åpningstider på våre informasjonssider",
              priority: 0,
              isDefault: true,
            } as const,
          ]
        : []),
      ...(branch.deliveryByMail
        ? [
            {
              id: needPickupPoint ? "mail_pickup_point" : "mailbox",
              amount: {
                value: isDeliveryFree ? 0 : deliveryPrice * 100,
                currency: "NOK",
              },
              brand: "POSTEN",
              title: needPickupPoint ? "Pakke til hentested" : "Pakke i postkasse",
              description: `Forventet levering om ${deliveryDays() + 2} dager`,
              type: needPickupPoint ? "PICKUP_POINT" : "MAILBOX",
              priority: 1,
              isDefault: order.amount === 0,
            } as const,
          ]
        : []),
    ],
  };
}

export const VippsCheckoutService = {
  async create(order: Order, isDeliveryFree: boolean) {
    const customer = await User.findOrFail(order.customerId);
    // Only a prefill, so a Bring outage must not stop the payment.
    const city = await BringService.postalCities().then(
      (cityOf) => cityOf(customer.postCode),
      () => null,
    );
    const [firstName, ...lastNames] = customer.name?.split(" ") ?? [];
    const { token, checkoutFrontendUrl } = await VippsPaymentService.checkout.create({
      type: "PAYMENT",
      prefillCustomer: {
        firstName: firstName ?? null,
        lastName: lastNames.length > 0 ? lastNames.join(" ") : null,
        email: customer.email,
        phoneNumber: customer.phone === null ? null : `47${customer.phone}`,
        streetAddress: customer.address ?? null,
        city,
        postalCode: customer.postCode ?? null,
        country: "NO",
      },
      merchantInfo: {
        callbackUrl: `https://${env.get("API_ENV") === "production" ? "" : "staging."}api.boklisten.no/checkout/vipps/callback`,
        returnUrl: `${clientOrigin}/kasse/betaling/status?orderId=${order.id}`,
        callbackAuthorizationToken: VippsPaymentService.token.issue(),
        termsAndConditionsUrl: `${clientOrigin}/info/policies/conditions`,
      },
      transaction: {
        reference: order.id,
        amount: {
          currency: "NOK",
          value: order.amount * 100,
        },
        paymentDescription:
          customer.name === null
            ? "Ordre fra Boklisten.no"
            : `${customer.name} sin ordre fra Boklisten.no`,
        orderSummary: {
          orderLines: order.orderItems.map((orderItem) => {
            const priceInMinors = orderItem.amount * 100;
            return {
              id: orderItem.itemId,
              name: `${orderItem.title} - ${TranslationService.translateOrderItemTypeImperative(orderItem.type)} ${orderItem.periodTo?.toFormat("dd/MM/yyyy") ?? ""}`,
              totalAmount: priceInMinors,
              taxRate: 0,
              totalTaxAmount: 0,
              totalAmountExcludingTax: priceInMinors,
            };
          }),
          orderBottomLine: {
            currency: "NOK",
          },
        },
      },
      logistics: await createLogistics(order, isDeliveryFree),
      configuration: {
        showOrderSummary: true,
      },
    });
    order.checkoutState = "SessionCreated";
    await order.save();
    return { token, checkoutFrontendUrl };
  },
  async update(session: VippsCheckoutSession) {
    await Order.whileLocked(session.reference, async () => {
      const order = await Order.getOrFail(session.reference);
      if (
        order.checkoutState === session.sessionState ||
        order.checkoutState === "PaymentSuccessful"
      ) {
        return;
      }

      order.checkoutState = session.sessionState;
      await order.save();

      if (session.sessionState !== "PaymentSuccessful") {
        return;
      }

      if (order.customerId === null) {
        throw new Error(`order "${order.id}" has no customer`);
      }
      // Vipps' billing details only address this shipment. They are never written to the account:
      // its email and phone are login identifiers, proven only through their own verification flows.
      const customer = await User.findOrFail(order.customerId);
      const billing = session.billingDetails;

      let deliveryPrice = 0;
      if (session.shippingDetails?.shippingMethodId?.includes("mail")) {
        deliveryPrice = Math.ceil((session.shippingDetails.amount?.value ?? 0) / 100);
        await Delivery.create({
          orderId: order.id,
          method: "bring",
          amount: deliveryPrice,
          bringAmount: deliveryPrice,
          estimatedDelivery: DateTime.now().plus({ days: deliveryDays() + 2 }),
          facilityAddress: "Martin Lingesvei 25",
          facilityPostalCode: "1364",
          shipmentName:
            session.shippingDetails.firstName && session.shippingDetails.lastName
              ? `${session.shippingDetails.firstName} ${session.shippingDetails.lastName}`
              : billing
                ? `${billing.firstName} ${billing.lastName}`
                : customer.name,
          shipmentAddress:
            session.shippingDetails.streetAddress ?? billing?.streetAddress ?? customer.address,
          shipmentPostalCode:
            session.shippingDetails.postalCode ?? billing?.postalCode ?? customer.postCode,
          fromPostalCode: "1364",
          toPostalCode:
            session.shippingDetails.postalCode ?? billing?.postalCode ?? customer.postCode,
          product: session.shippingDetails.shippingMethodId === "mailbox" ? "3584" : "SERVICEPAKKE",
        });
      }

      await Payment.create({
        orderId: order.id,
        method: "vipps-checkout",
        amount: order.amount + deliveryPrice,
        confirmed: false,
      });

      await new OrderPlacedHandler().placeOrder(order, order.customerId);

      try {
        await VippsPaymentService.payment.capture(order.id, (order.amount + deliveryPrice) * 100);
      } catch (error) {
        Sentry.captureException(error);
      }
    });
  },
};
