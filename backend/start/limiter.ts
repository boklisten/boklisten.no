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

/** Per client, for public endpoints that send mail or create rows. */
export const throttle = limiter.define("global", (ctx) =>
  limiter.allowRequests(10).every("1 minute").usingKey(ctx.request.ip()),
);

/**
 * Per account on top of the per-client limit, so one password cannot be guessed from many
 * clients: five attempts a minute, then a quarter of an hour's pause.
 */
export const loginThrottle = limiter.define("login", (ctx) =>
  limiter
    .allowRequests(5)
    .every("1 minute")
    .blockFor("15 minutes")
    .usingKey(`login_${String(ctx.request.input("username", "")).trim().toLowerCase()}`),
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
