import type { Order } from "#shared/order/order";
import { StorageService } from "#services/storage_service";
import env from "#start/env";
import createClient from "openapi-fetch";
import type { paths } from "#services/kustom/openapi/checkout";
import { TranslationService } from "#services/translation_service";
import { DateService } from "#services/legacy/date.service";
import { DateTime } from "luxon";
import { BringService } from "#services/bring/bring_service";
import { DeliveryService } from "#services/delivery_service";

const KUSTOM_BASE_URL =
  env.get("API_ENV") === "production"
    ? "https://api.kustom.co/"
    : "https://api.playground.kustom.co/";

const client = createClient<paths>({
  baseUrl: KUSTOM_BASE_URL,
  headers: {
    Authorization: `Basic ${env.get("KUSTOM_KEY").release()}`,
  },
});

async function createShippingOptions(order: Order, toPostalCode: string, isDeliveryFree: boolean) {
  const needShipping = order.orderItems.some(
    (orderItem) =>
      orderItem.type === "rent" || orderItem.type === "partly-payment" || orderItem.type === "buy",
  );
  if (!needShipping) return [];

  const weightInGrams = await DeliveryService.calculateOrderWeightInGrams(order);

  const shippingInfo = await BringService.getShippingInfo({
    toPostalCode,
    isPostal: DeliveryService.isPostal(weightInGrams, order.orderItems.length),
    weightInGrams,
  });

  return [
    {
      id: "posten",
      name: shippingInfo?.guiInformation?.displayName ?? "Pakke til hentested",
      description:
        (shippingInfo?.guiInformation?.descriptionText ??
          "Pakke til hentested leveres til mottakers valgte hentested (pakkeboks, post i butikk eller postkontor). Mottaker følger pakken og varsles når sendingen er ankommet via Posten-appen eller hentemelding i postkassen.") +
        " Forventet levering: " +
        shippingInfo?.expectedDelivery?.formattedExpectedDeliveryDate,
      price: isDeliveryFree
        ? 0
        : Math.round(
            Number(
              shippingInfo?.price?.listPrice?.priceWithAdditionalServices?.amountWithVAT ?? 200,
            ),
          ) * 100,
      tax_amount: 0,
      tax_rate: 0,
      shipping_method: shippingInfo?.guiInformation?.deliveryType
        ?.toLocaleLowerCase()
        .includes("postkasse")
        ? "Postal"
        : "PickUpPoint",
      delivery_details: {
        carrier: "Posten",
      },
    },
  ];
}

export const KustomCheckoutService = {
  async createOrder(order: Order, isDeliveryFree: boolean) {
    const userDetail = await StorageService.UserDetails.get(order.customer);
    const nameParts = userDetail.name.split(" ");
    const givenName = nameParts.length > 1 ? nameParts.slice(0, -1).join(" ") : userDetail.name;
    const familyName = nameParts.length > 1 ? nameParts.at(-1) : undefined;
    const address = {
      given_name: givenName,
      family_name: familyName,
      email: userDetail.email,
      phone: userDetail.phone,
      street_address: userDetail.address,
      postal_code: userDetail.postCode,
      city: userDetail.postCity,
      country: "NO",
    };

    return await client.POST("/checkout/v3/orders", {
      body: {
        purchase_country: "no",
        purchase_currency: "NOK",
        locale: "nb-NO",
        order_amount: order.amount * 100,
        order_tax_amount: 0,
        order_lines: order.orderItems.map((orderItem) => {
          const priceInMinors = orderItem.amount * 100;
          return {
            type: "physical",
            reference: orderItem.item,
            name: `${orderItem.title} - ${TranslationService.translateOrderItemTypeImperative(orderItem.type)} ${orderItem.info?.to ? DateService.format(orderItem.info?.to, "Europe/Oslo", "DD/MM/YYYY") : ""}`,
            quantity: 1,
            unit_price: priceInMinors,
            tax_rate: 0,
            total_amount: priceInMinors,
            total_tax_amount: 0,
          };
        }),
        billing_address: address,
        shipping_address: address,
        customer: {
          date_of_birth: DateTime.fromJSDate(userDetail.dob).toISODate() ?? undefined,
        },
        merchant_urls: {
          terms: `${env.get("CLIENT_URI")}/info/policies/terms`,
          checkout: `${env.get("CLIENT_URI")}/kasse/betaling/v2/${order.id}`,
          confirmation: `https://${env.get("API_ENV") === "production" ? "" : "staging."}boklisten.no/kasse/betaling/v2/${order.id}`,
          push: `https://${env.get("API_ENV") === "production" ? "" : "staging."}api.boklisten.no/v2/checkout/push`,
        },
        merchant_reference1: order.id,
        options: {
          auto_capture: true,
          vat_removed: true,
          allow_separate_shipping_address: true,
          show_subtotal_detail: true,
        },
        shipping_options: await createShippingOptions(order, userDetail.postCode, isDeliveryFree),
      },
    });
  },
  async getOrder(kustomOrderId: string) {
    return await client.GET(`/checkout/v3/orders/{order_id}`, {
      params: {
        path: {
          order_id: kustomOrderId,
        },
      },
    });
  },
};
