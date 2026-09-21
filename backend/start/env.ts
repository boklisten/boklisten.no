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

/**
 * Which environment this is comes from the platform, not from configuration: Railway names its
 * environments `production` and `staging`, the test runner sets NODE_ENV, and anything else is a
 * developer's machine. Set before validation so it is checked like every other variable.
 */
process.env["API_ENV"] =
  process.env["RAILWAY_ENVIRONMENT_NAME"] ?? (process.env["NODE_ENV"] === "test" ? "test" : "dev");

/** Credentials are `secret()`: they print as `[redacted]` and are read with `.release()` where used. */
export default await Env.create(new URL("../", import.meta.url), {
  APP_KEY: Env.schema.secret(),
  API_ENV: Env.schema.enum(["dev", "test", "staging", "production"] as const),
  LOG_LEVEL: Env.schema.enum.optional([
    "fatal",
    "error",
    "warn",
    "info",
    "debug",
    "trace",
    "silent",
  ] as const),
  /**
   * Set by Railway for every service with a domain: this service's own and the frontend's. The
   * API's and the frontend's origins are built from them (`config/app.ts`).
   */
  RAILWAY_PUBLIC_DOMAIN: Env.schema.string.optional(),
  RAILWAY_SERVICE_BOKLISTEN_NO_URL: Env.schema.string.optional(),
  PORT: Env.schema.number.optional(),
  MONGODB_URI: Env.schema.secret(),
  POSTGRES_URL: Env.schema.secret(),
  VIPPS_MSN: Env.schema.string(),
  VIPPS_CLIENT_ID: Env.schema.string(),
  VIPPS_SECRET: Env.schema.secret(),
  VIPPS_SUBSCRIPTION_KEY: Env.schema.secret(),
  VIPPS_MT_MSN: Env.schema.string(),
  VIPPS_MT_CLIENT_ID: Env.schema.string(),
  VIPPS_MT_SECRET: Env.schema.secret(),
  VIPPS_MT_SUBSCRIPTION_KEY: Env.schema.secret(),
  SENDGRID_API_KEY: Env.schema.secret(),
  SENDGRID_WEBHOOK_PUBLIC_KEY: Env.schema.string.optional(),
  /** Dedicated key with only the "Email Address Validation" scope; form feedback is skipped without it. */
  SENDGRID_EMAIL_VALIDATION_API_KEY: Env.schema.secret.optional(),
  TWILIO_SMS_AUTH_TOKEN: Env.schema.secret(),
  TWILIO_SMS_SID: Env.schema.string(),
  BRING_API_KEY: Env.schema.secret(),
  BRING_API_ID: Env.schema.string({ format: "email" }),
});
