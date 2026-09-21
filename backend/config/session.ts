import { defineConfig, stores } from "@adonisjs/session";

import { cookieDomain, cookieEnvironmentSuffix, isDeployed } from "#config/app";

/**
 * Logins are HTTP sessions in Postgres (see `config/auth.ts`). A session lives two hours past
 * its last request; the remember-me token then restores it silently, so customers stay logged
 * in for a year while every login can still be ended server-side.
 */
const sessionConfig = defineConfig({
  enabled: true,
  cookieName: `bl_session${cookieEnvironmentSuffix}`,
  clearWithBrowser: false,
  age: "2h",
  cookie: {
    domain: cookieDomain,
    path: "/",
    httpOnly: true,
    secure: isDeployed,
    sameSite: "lax",
  },
  store: "database",
  stores: {
    database: stores.database({ tableName: "sessions" }),
  },
});

export default sessionConfig;
