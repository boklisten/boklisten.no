import { defineConfig } from "@adonisjs/core/http";

import env from "#start/env";

export const appKey = env.get("APP_KEY");

const API_ENV = env.get("API_ENV");

/** Staging and production serve over HTTPS and share the `boklisten.no` site; dev and test are plain localhost. */
export const isDeployed = API_ENV === "production" || API_ENV === "staging";

/**
 * The origin the API itself answers on, for URLs it hands to other servers (the Vipps callback,
 * Twilio's status callback) and to the local test login link. Railway tells every service its
 * public domain, which is the custom domain when one is attached; locally it is the dev server.
 */
export const apiOrigin = isDeployed
  ? `https://${deployedDomain("RAILWAY_PUBLIC_DOMAIN")}`
  : `http://localhost:${env.get("PORT", 3333)}`;

/**
 * The origin the frontend is served from: where the API sends browsers and links in mail, the only
 * origin CORS lets call the API with cookies, and the only one state-changing requests may come
 * from (`verify_origin_middleware`). Railway hands each service the domains of the others.
 */
export const clientOrigin = isDeployed
  ? `https://${deployedDomain("RAILWAY_SERVICE_BOKLISTEN_NO_URL")}`
  : "http://localhost:3000";

function deployedDomain(
  variable: "RAILWAY_PUBLIC_DOMAIN" | "RAILWAY_SERVICE_BOKLISTEN_NO_URL",
): string {
  const domain = env.get(variable);
  if (!domain) {
    throw new Error(`${variable} is not set; Railway injects it for every service with a domain`);
  }
  return domain;
}

/**
 * Cookies are set for the whole site so that the browser also sends them to the frontend server
 * (`boklisten.no`), which forwards them to the API when it renders a page. Empty means host-only,
 * which is what localhost needs.
 */
export const cookieDomain = isDeployed ? "boklisten.no" : "";

/**
 * Staging (`staging.boklisten.no`) and production share the cookie domain, so their cookies must
 * not share names or a login on one would overwrite the other's.
 */
export const cookieEnvironmentSuffix = API_ENV === "staging" ? "_staging" : "";

export const http = defineConfig({
  generateRequestId: true,
  allowMethodSpoofing: false,
  useAsyncLocalStorage: false,
  /**
   * Deployed, every request arrives through Railway's edge, which puts the client's address in
   * `X-Real-IP`; the socket address is the edge itself, so without this the per-client limiters
   * in `start/limiter.ts` would count everyone as one client.
   */
  getIp: (request, socketIp) => (isDeployed ? request.header("x-real-ip") : null) ?? socketIp(),
  cookie: {
    domain: cookieDomain,
    path: "/",
    maxAge: "2h",
    httpOnly: true,
    secure: isDeployed,
    sameSite: "lax",
  },
});
