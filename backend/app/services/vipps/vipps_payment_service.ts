import string from "@adonisjs/core/helpers/string";
import encryption from "@adonisjs/core/services/encryption";
import { Client } from "@vippsmobilepay/sdk";

import env from "#start/env";

const isProduction = env.get("API_ENV") === "production";
const vippsEnv = {
  msn: env.get(isProduction ? "VIPPS_MSN" : "VIPPS_MT_MSN"),
  clientId: env.get(isProduction ? "VIPPS_CLIENT_ID" : "VIPPS_MT_CLIENT_ID"),
  clientSecret: env.get(isProduction ? "VIPPS_SECRET" : "VIPPS_MT_SECRET"),
  subscriptionKey: env.get(isProduction ? "VIPPS_SUBSCRIPTION_KEY" : "VIPPS_MT_SUBSCRIPTION_KEY"),
} as const satisfies Record<string, string>;

const client = Client({
  merchantSerialNumber: vippsEnv.msn,
  subscriptionKey: vippsEnv.subscriptionKey,
  useTestMode: !isProduction,
  systemName: "boklisten",
  systemVersion: "1.0.0",
  pluginName: env.get("API_ENV"),
  pluginVersion: "1.0.0",
});

const callbackTokenPurpose = "vipps-callback";
export const VippsPaymentService = {
  checkout: {
    create: async (payload: Parameters<typeof client.checkout.create>[2]) => {
      const checkout = await client.checkout.create(
        vippsEnv.clientId,
        vippsEnv.clientSecret,
        payload,
      );
      if (!checkout.ok) {
        throw new Error(JSON.stringify(checkout.error));
      }
      const { token, checkoutFrontendUrl, pollingUrl } = checkout.data;
      return {
        token,
        checkoutFrontendUrl,
        reference: pollingUrl.split("/").at(-1) ?? "",
      };
    },
    info: async (reference: string) => {
      const info = await client.checkout.info(vippsEnv.clientId, vippsEnv.clientSecret, reference);
      if (!info.ok) {
        throw new Error(JSON.stringify(info.error));
      }
      return info.data;
    },
  },
  payment: {
    capture: async (reference: string, amountInMinorUnits: number) => {
      const accessToken = await client.auth.getToken(vippsEnv.clientId, vippsEnv.clientSecret);
      if (!accessToken.ok) {
        throw new Error(JSON.stringify(accessToken.error));
      }
      const capture = await client.payment.capture(accessToken.data.access_token, reference, {
        modificationAmount: {
          currency: "NOK",
          value: amountInMinorUnits,
        },
      });
      if (!capture.ok) {
        throw new Error(JSON.stringify(capture.error));
      }
      return capture.data;
    },
  },
  token: {
    issue: () => encryption.encrypt(string.random(32), "1 day", callbackTokenPurpose),
    verify: (token: string) => !!encryption.decrypt(token, callbackTokenPurpose),
  },
};
