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

export const throttle = limiter.define("global", () => limiter.allowRequests(10).every("1 minute"));

export const emailValidationThrottle = limiter.define("email_validation", () =>
  limiter.allowRequests(20).every("1 minute"),
);

/** Per account; runs after the group's auth middleware, so `ctx.authUser` is set. */
export const publicBlidLookupThrottle = limiter.define("public_blid_lookup", (ctx) =>
  limiter.allowRequests(100).every("1 day").usingKey(ctx.authUser.detailsId),
);

export const publicBlidMissLimiter = limiter.use({
  requests: 10,
  duration: "1 day",
  blockDuration: "1 day",
});
