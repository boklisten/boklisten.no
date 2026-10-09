/*
|--------------------------------------------------------------------------
| Define HTTP limiters
|--------------------------------------------------------------------------
|
| The "limiter.define" method creates an HTTP middleware to apply rate
| limits on a route or a group of routes. Feel free to define as many
| throttle middleware as needed.
|
*/

import limiter from "@adonisjs/limiter/services/main";

import { phoneDigits } from "#shared/phone_number";
import { isDeployed } from "#config/app";

/** Per client, for public endpoints that send mail or create rows. */
export const throttle = limiter.define("global", (ctx) =>
  limiter.allowRequests(10).every("1 minute").usingKey(ctx.request.ip()),
);

/** Per client for the SMS routes, looser than `throttle`: a whole class shares the school's address. */
export const smsClientThrottle = limiter.define("sms_client", (ctx) =>
  limiter.allowRequests(60).every("1 minute").usingKey(ctx.request.ip()),
);

/** Per number, so no one floods a number with codes or draws many codes to guess at. */
export const smsCodeThrottle = limiter.define("sms_code", (ctx) =>
  isDeployed
    ? limiter
        .allowRequests(5)
        .every("1 hour")
        .usingKey(phoneDigits(String(ctx.request.input("phone", ""))))
    : null,
);

export const emailValidationThrottle = limiter.define("email_validation", () =>
  limiter.allowRequests(20).every("1 minute"),
);

/** Per account; runs after the group's auth middleware, so the user is known. */
export const publicBlidLookupThrottle = limiter.define("public_blid_lookup", (ctx) =>
  limiter.allowRequests(100).every("1 day").usingKey(ctx.auth.getUserOrFail().id),
);

export const publicBlidMissLimiter = limiter.use({
  requests: 10,
  duration: "1 day",
  blockDuration: "1 day",
});
