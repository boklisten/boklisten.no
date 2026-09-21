import { Exception } from "@adonisjs/core/exceptions";
import type { HttpContext } from "@adonisjs/core/http";
import type { NextFn } from "@adonisjs/core/types/http";

import { clientOrigin } from "#config/app";

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Routes other servers call with signed payloads and therefore without a browser `Origin`
 * (see the public section of `start/routes.ts`).
 */
const ORIGIN_EXEMPT_ROUTE_PATTERNS = new Set([
  "/checkout/vipps/callback",
  "/webhooks/sendgrid",
  "/webhooks/twilio/:messageId",
]);

/** The `Origin` header, or the origin of the `Referer` for the few browsers that omit it. */
export function requestOrigin(headers: { origin?: string; referer?: string }): string | null {
  if (headers.origin) {
    return headers.origin;
  }
  if (!headers.referer) {
    return null;
  }
  try {
    return new URL(headers.referer).origin;
  } catch {
    return null;
  }
}

/**
 * CSRF protection for the cookie session: a state-changing request must come from one of our own
 * pages. Browsers always send `Origin` on cross-site requests and on `fetch` from our frontend, and
 * the cookie's `SameSite=Lax` already stops the plain cross-site form post.
 *
 * @throws Exception (403, E_BAD_ORIGIN) when the origin is missing or not the frontend's
 */
export default class VerifyOriginMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    if (
      !UNSAFE_METHODS.has(ctx.request.method()) ||
      (ctx.route !== undefined && ORIGIN_EXEMPT_ROUTE_PATTERNS.has(ctx.route.pattern))
    ) {
      return next();
    }
    const origin = requestOrigin({
      origin: ctx.request.header("origin"),
      referer: ctx.request.header("referer"),
    });
    if (origin !== clientOrigin) {
      throw new Exception("Forespørselen kom ikke fra boklisten.no.", {
        status: 403,
        code: "E_BAD_ORIGIN",
      });
    }
    return next();
  }
}
