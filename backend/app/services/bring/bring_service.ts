import env from "#start/env";
import { bringPostalCodeResponseValidator } from "#validators/bring_validators";
import { DateTime } from "luxon";
import { APP_CONFIG } from "#services/application_config";
import createClient from "openapi-fetch";
import type { paths as shippingGuidePaths } from "#services/bring/openapi/shippingguide";

const bringHeaders = {
  "X-MyBring-API-Key": env.get("BRING_API_KEY"),
  "X-MyBring-API-Uid": env.get("BRING_API_ID"),
  "Content-Type": "application/json",
  Accept: "application/json",
} as const;

const shippingGuideClient = createClient<shippingGuidePaths>({
  baseUrl: "https://api.bring.com/shippingguide",
  headers: bringHeaders,
});

export const BringService = {
  async lookupPostalCode(postalCode: string) {
    const bringResponse = await (
      await fetch(`https://api.bring.com/address/api/NO/postal-codes/${postalCode}`, {
        headers: bringHeaders,
      })
    ).json();
    const [, data] = await bringPostalCodeResponseValidator.tryValidate(bringResponse);
    return data?.postal_codes[0]?.city ?? null;
  },
  async getShippingInfo({
    toPostalCode,
    isPostal,
    weightInGrams,
  }: {
    toPostalCode: string;
    isPostal: boolean;
    weightInGrams: number;
  }) {
    const expectedShippingDate = DateTime.now().plus({ days: APP_CONFIG.delivery.deliveryDays });
    const { data } = await shippingGuideClient.POST("/api/v2/products", {
      params: {
        header: bringHeaders,
      },
      body: {
        language: "NO",
        numberOfAlternativeDeliveryDates: null,
        edi: true,
        postingAtPostoffice: true,
        withEstimatedDeliveryTime: false,
        withEnvironmentalData: false,
        withPrice: true,
        withExpectedDelivery: true,
        withGuiInformation: true,
        consignments: [
          {
            products: [
              {
                id: isPostal ? "3584" : "5800",
              },
            ],
            shippingDate: {
              day: expectedShippingDate.day.toString(),
              month: expectedShippingDate.month.toString(),
              year: expectedShippingDate.year.toString(),
            },
            packages: [
              {
                grossWeight: weightInGrams,
                volumeSpecial: null,
                nonStackable: null,
                numberOfPallets: null,
              },
            ],
            fromCountryCode: "NO",
            fromPostalCode: "1364",
            toCountryCode: "NO",
            toPostalCode,
          },
        ],
      },
    });
    return data?.consignments?.[0]?.products?.[0];
  },
};
