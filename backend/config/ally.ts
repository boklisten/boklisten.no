import { defineConfig } from "@adonisjs/ally";

import { VippsDriverService } from "#services/vipps/vipps_driver_service";
import env from "#start/env";
import type { InferSocialProviders } from "@adonisjs/ally/types";

const allyConfig = defineConfig({
  vipps: VippsDriverService({
    environment: "production",
    clientId: env.get("VIPPS_CLIENT_ID"),
    clientSecret: env.get("VIPPS_SECRET"),
    callbackUrl: `${env.get("BL_API_URI")}/auth/vipps/callback`,
    scopes: ["openid", "email", "phoneNumber", "address", "name"],
  }),
});
export default allyConfig;
declare module "@adonisjs/ally/types" {
  interface SocialProviders extends InferSocialProviders<typeof allyConfig> {}
}
