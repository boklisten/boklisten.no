import moment from "moment";

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
    // If in season, lower the delivery estimate
    deliveryDays:
      moment().isBetween(
        moment().clone().set({ month: 7, date: 5 }),
        moment().clone().set({ month: 8, date: 10 }),
      ) ||
      moment().isBetween(
        moment().clone().set({ month: 0, date: 7 }),
        moment().clone().set({ month: 1, date: 8 }),
      )
        ? 3
        : 7,
    maxWeightLetter: 3000,
  },
} as const;
