import { defineConfig } from "@adonisjs/ally";

import { apiOrigin } from "#config/app";
import { VippsDriverService } from "#services/vipps/vipps_driver_service";
import env from "#start/env";
import type { InferSocialProviders } from "@adonisjs/ally/types";

const allyConfig = defineConfig({
  vipps: VippsDriverService({
    environment: "production",
    clientId: env.get("VIPPS_CLIENT_ID"),
    clientSecret: env.get("VIPPS_SECRET").release(),
    callbackUrl: `${apiOrigin}/auth/vipps/callback`,
    scopes: ["openid", "email", "phoneNumber", "address", "name"],
  }),
});
export default allyConfig;
declare module "@adonisjs/ally/types" {
  interface SocialProviders extends InferSocialProviders<typeof allyConfig> {}
}
