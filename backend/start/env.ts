/*
|--------------------------------------------------------------------------
| Environment variables service
|--------------------------------------------------------------------------
|
| The `Env.create` method creates an instance of the Env service. The
| service validates the environment variables and also cast values
| to JavaScript data enums.
|
*/

import { Env } from "@adonisjs/core/env";

export default await Env.create(new URL("../", import.meta.url), {
  APP_KEY: Env.schema.string(),
  API_ENV: Env.schema.enum(["dev", "test", "staging", "production"] as const),
  LOG_LEVEL: Env.schema.enum([
    "fatal",
    "error",
    "warn",
    "info",
    "debug",
    "trace",
    "silent",
  ] as const),
  URI_WHITELIST: Env.schema.string(),
  ACCESS_TOKEN_SECRET: Env.schema.string(),
  REFRESH_TOKEN_SECRET: Env.schema.string(),
  SESSION_SECRET: Env.schema.string(),
  BL_API_URI: Env.schema.string(),
  CLIENT_URI: Env.schema.string(),
  MONGODB_URI: Env.schema.string(),
  POSTGRES_URL: Env.schema.string(),
  VIPPS_MSN: Env.schema.string(),
  VIPPS_CLIENT_ID: Env.schema.string(),
  VIPPS_SECRET: Env.schema.string(),
  VIPPS_SUBSCRIPTION_KEY: Env.schema.string(),
  VIPPS_MT_MSN: Env.schema.string(),
  VIPPS_MT_CLIENT_ID: Env.schema.string(),
  VIPPS_MT_SECRET: Env.schema.string(),
  VIPPS_MT_SUBSCRIPTION_KEY: Env.schema.string(),
  SENDGRID_API_KEY: Env.schema.string(),
  TWILIO_SMS_AUTH_TOKEN: Env.schema.string(),
  TWILIO_SMS_SID: Env.schema.string(),
  BRING_API_KEY: Env.schema.string(),
  BRING_API_ID: Env.schema.string({ format: "email" }),
  SENTRY_AUTH_TOKEN: Env.schema.string(),
});
