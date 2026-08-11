import logger from "@adonisjs/core/services/logger";
import * as Sentry from "@sentry/node";
import moment from "moment-timezone";

import { APP_CONFIG } from "#services/legacy/application-config";
import { DeliveryService } from "#services/delivery_service";
import { OrderPlacedHandler } from "#services/legacy/collections/order/helpers/order-placed-handler/order-placed-handler";
import { DateService } from "#services/legacy/date.service";
import { StorageService } from "#services/storage_service";
import { TranslationService } from "#services/translation_service";
import { VippsPaymentService } from "#services/vipps/vipps_payment_service";
import { Order } from "#shared/order/order";
import env from "#start/env";
import { VippsCheckoutSession } from "#validators/checkout_validators";

async function updateUserDetailWithBillingDetails(
  session: VippsCheckoutSession,
  customerId: string,
) {
  try {
    if (session.billingDetails) {
      const existingDetails = await StorageService.UserDetails.get(customerId);
      await StorageService.UserDetails.update(customerId, {
        name: `${session.billingDetails.firstName} ${session.billingDetails.lastName}`,
        phone: session.billingDetails.phoneNumber.slice(-8),
        email: session.billingDetails.email,
        address: session.billingDetails.streetAddress ?? existingDetails.address,
        postCode: session.billingDetails.postalCode ?? existingDetails.postCode,
        postCity: session.billingDetails.city ?? existingDetails.postCity,
      });
    }
  } catch (error) {
    logger.error(error);
  }
  return await StorageService.UserDetails.get(customerId);
}

async function createLogistics(order: Order, isDeliveryFree: boolean) {
  const needLogistics = order.orderItems.some(
    (orderItem) =>
      orderItem.type === "rent" || orderItem.type === "partly-payment" || orderItem.type === "buy",
  );
  if (!needLogistics) return null;

  const totalWeightInGrams = await DeliveryService.calculateOrderWeightInGrams(order);

  const needPickupPoint = !DeliveryService.isPostal(totalWeightInGrams, order.orderItems.length);

  const deliveryPrice = Math.ceil((totalWeightInGrams / 1000) * 20) + (needPickupPoint ? 150 : 75);

  const branch = await StorageService.Branches.get(order.branch);
  return {
    fixedOptions: [
      ...(order.amount > 0 && branch.deliveryMethods?.branch
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
      ...(branch.deliveryMethods?.byMail
        ? [
            {
              id: needPickupPoint ? "mail_pickup_point" : "mailbox",
              amount: {
                value: isDeliveryFree ? 0 : deliveryPrice * 100,
                currency: "NOK",
              },
              brand: "POSTEN",
              title: needPickupPoint ? "Pakke til hentested" : "Pakke i postkasse",
              description: `Forventet levering om ${APP_CONFIG.delivery.deliveryDays + 2} dager`,
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
    const userDetail = await StorageService.UserDetails.get(order.customer);
    const { token, checkoutFrontendUrl } = await VippsPaymentService.checkout.create({
      type: "PAYMENT",
      prefillCustomer: {
        firstName: userDetail.name.split(" ")[0] ?? null,
        lastName: userDetail.name.split(" ").slice(1).join(" ") ?? null,
        email: userDetail.email,
        phoneNumber: `47${userDetail.phone}`,
        streetAddress: userDetail.address ?? null,
        city: userDetail.postCity ?? null,
        postalCode: userDetail.postCode ?? null,
        country: "NO",
      },
      merchantInfo: {
        callbackUrl: `https://${env.get("API_ENV") === "production" ? "" : "staging."}api.boklisten.no/checkout/vipps/callback`,
        returnUrl: `${env.get("CLIENT_URI")}/kasse/betaling/status?orderId=${order.id}`,
        callbackAuthorizationToken: VippsPaymentService.token.issue(),
        termsAndConditionsUrl: `${env.get("CLIENT_URI")}/info/policies/conditions`,
      },
      transaction: {
        reference: order.id,
        amount: {
          currency: "NOK",
          value: order.amount * 100,
        },
        paymentDescription: `${userDetail.name} sin ordre fra Boklisten.no`,
        orderSummary: {
          orderLines: order.orderItems.map((orderItem) => {
            const priceInMinors = orderItem.amount * 100;
            return {
              id: orderItem.item,
              name: `${orderItem.title} - ${TranslationService.translateOrderItemTypeImperative(orderItem.type)} ${orderItem.info?.to ? DateService.format(orderItem.info?.to, "Europe/Oslo", "DD/MM/YYYY") : ""}`,
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
    await StorageService.Orders.update(order.id, {
      checkoutState: "SessionCreated",
    });
    return { token, checkoutFrontendUrl };
  },
  async update(session: VippsCheckoutSession) {
    let order = await StorageService.Orders.get(session.reference);
    if (order.checkoutState === session.sessionState || order.checkoutState === "PaymentSuccessful")
      return;

    await StorageService.Orders.update(order.id, {
      checkoutState: session.sessionState,
    });

    if (session.sessionState !== "PaymentSuccessful") return;

    const userDetail = await updateUserDetailWithBillingDetails(session, order.customer);

    let deliveryPrice = 0;
    if (session.shippingDetails?.shippingMethodId?.includes("mail")) {
      deliveryPrice = Math.ceil((session.shippingDetails.amount?.value ?? 0) / 100);
      const delivery = await StorageService.Deliveries.add({
        method: "bring",
        info: {
          amount: deliveryPrice,
          estimatedDelivery: moment()
            .add(APP_CONFIG.delivery.deliveryDays + 2, "days")
            .toDate(),
          taxAmount: deliveryPrice * 0.25,
          facilityAddress: {
            address: "Martin Lingesvei 25",
            postalCode: "1364",
            postalCity: "FORNEBU",
          },
          shipmentAddress: {
            name:
              session.shippingDetails.firstName && session.shippingDetails.lastName
                ? `${session.shippingDetails.firstName} ${session.shippingDetails.lastName}`
                : userDetail.name,
            address: session.shippingDetails.streetAddress ?? userDetail.address,
            postalCode: session.shippingDetails.postalCode ?? userDetail.postCode,
            postalCity: session.shippingDetails.city ?? userDetail.postCity,
          },
          from: "1364",
          to: session.shippingDetails.postalCode ?? userDetail.postCode,
          product: session.shippingDetails.shippingMethodId === "mailbox" ? "3584" : "SERVICEPAKKE",
        },
        order: session.reference,
        amount: deliveryPrice,
        user: {
          id: userDetail.user?.id ?? "",
          permission: userDetail.user?.permission ?? "customer",
        },
      });
      await StorageService.Orders.update(order.id, {
        delivery: delivery.id,
      });
    }

    const payment = await StorageService.Payments.add({
      method: "vipps-checkout",
      order: order.id,
      amount: order.amount + deliveryPrice,
      customer: order.customer,
      branch: order.branch,
    });

    order = await StorageService.Orders.update(order.id, {
      payments: [...(order.payments ?? []), payment.id],
    });

    await new OrderPlacedHandler().placeOrder(order, order.customer);

    try {
      await VippsPaymentService.payment.capture(order.id, (order.amount + deliveryPrice) * 100);
    } catch (error) {
      Sentry.captureException(error);
    }
  },
};
