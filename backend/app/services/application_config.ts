import { DateTime } from "luxon";

/** The weeks around school start when Bring is quick, as [month, day] bounds, inclusive. */
const DELIVERY_HIGH_SEASONS: { from: [number, number]; to: [number, number] }[] = [
  { from: [8, 5], to: [9, 10] },
  { from: [1, 7], to: [2, 8] },
];

/**
 * Days Bring is expected to need for a shipment: shorter in season. Evaluated per call because
 * the process stays up across season boundaries.
 */
export function deliveryDays(now: DateTime = DateTime.now()): number {
  const inSeason = DELIVERY_HIGH_SEASONS.some(
    ({ from, to }) =>
      now >= now.set({ month: from[0], day: from[1] }).startOf("day") &&
      now <= now.set({ month: to[0], day: to[1] }).endOf("day"),
  );
  return inSeason ? 3 : 7;
}

export const APP_CONFIG = {
  path: {
    client: {
      checkout: "cart/confirm",
      agreement: {
        rent: "info/policies/conditions",
      },
      auth: {
        failure: "auth/authentication/failure",
      },
    },
    host: "boklisten",
    local: {
      host: "localhost",
    },
  },
  server: {
    basePath: "http://localhost:3333",
  },
  url: {
    bring: {
      shipmentInfo: "https://api.bring.com/shippingguide/v2/products",
    },
  },
  dev: {
    server: {
      host: "https://localhost",
      port: 3333,
      path: "api",
      version: "v1",
    },
    client: {
      base: "https://localhost:3000/",
    },
    mongoDb: {
      basePath: "mongodb://",
      host: "localhost",
      port: 27_017,
    },
  },
  prod: {
    server: {
      host: "",
      port: 0,
      path: "",
      version: "",
    },
    mongoDb: {
      basePath: "",
      host: "",
      port: 0,
      dbName: "",
    },
  },
  test: true,
  login: {
    local: {
      name: "local",
    },
  },
  token: {
    refresh: {
      iss: "boklisten.no",
      aud: "boklisten.no",
      expiresIn: "1 Year",
    },
    access: {
      iss: "boklisten.no",
      aud: "boklisten.no",
      expiresIn: "10 Minutes",
    },
  },
  date: {
    cancelDays: 14,
  },
  payment: {
    paymentServiceConfig: {
      roundDown: true,
      roundUp: false,
    },
  },
  delivery: {
    maxWeightLetter: 3000,
  },
} as const;
