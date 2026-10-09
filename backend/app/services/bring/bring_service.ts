import env from "#start/env";
import { bringPostalCodeResponseValidator } from "#validators/bring_validators";
import { DateTime } from "luxon";
import { deliveryDays } from "#services/application_config";
import createClient from "openapi-fetch";
import type { paths as shippingGuidePaths } from "#services/bring/openapi/shippingguide";

const bringHeaders = {
  "X-MyBring-API-Key": env.get("BRING_API_KEY").release(),
  "X-MyBring-API-Uid": env.get("BRING_API_ID"),
  "Content-Type": "application/json",
  Accept: "application/json",
} as const;

const shippingGuideClient = createClient<shippingGuidePaths>({
  baseUrl: "https://api.bring.com/shippingguide",
  headers: bringHeaders,
});

/** Posten changes the register a few times a year; a day-old copy is fresh enough. */
const POSTAL_REGISTER_MAX_AGE_MS = 24 * 60 * 60 * 1000;

let postalRegister: { cities: ReadonlyMap<string, string>; fetchedAt: number } | null = null;
let postalRegisterRequest: Promise<ReadonlyMap<string, string>> | null = null;

/** The whole Norwegian postal register in one call (about 5,000 codes), city by postal code. */
async function fetchPostalRegister(): Promise<ReadonlyMap<string, string>> {
  const response = await fetch("https://api.bring.com/address/api/NO/postal-codes", {
    headers: bringHeaders,
  });
  if (!response.ok) {
    throw new Error(`Bring answered ${response.status} for the postal register`);
  }
  const { postal_codes } = await bringPostalCodeResponseValidator.validate(await response.json());
  const cities = new Map(postal_codes.map(({ postal_code, city }) => [postal_code, city]));
  postalRegister = { cities, fetchedAt: Date.now() };
  return cities;
}

async function postalRegisterCities(): Promise<ReadonlyMap<string, string>> {
  if (postalRegister && Date.now() - postalRegister.fetchedAt < POSTAL_REGISTER_MAX_AGE_MS) {
    return postalRegister.cities;
  }
  postalRegisterRequest ??= fetchPostalRegister().finally(() => {
    postalRegisterRequest = null;
  });
  try {
    return await postalRegisterRequest;
  } catch (error) {
    // A stale register beats none; the next call tries Bring again.
    if (postalRegister) {
      return postalRegister.cities;
    }
    throw error;
  }
}

export const BringService = {
  /**
   * Looks postal codes up in Posten's register, which is how every postal city is found: none is
   * stored. A code missing from the register (a typo, or one Posten has retired) has no city.
   */
  async postalCities(): Promise<(postalCode: string | null) => string | null> {
    const cities = await postalRegisterCities();
    function cityOf(postalCode: string | null): string | null {
      return cities.get(postalCode?.trim() ?? "") ?? null;
    }
    return cityOf;
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
    const expectedShippingDate = DateTime.now().plus({ days: deliveryDays() });
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
