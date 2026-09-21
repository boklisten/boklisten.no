import { defineConfig } from "@adonisjs/auth";
import { sessionGuard, sessionUserProvider } from "@adonisjs/auth/session";
import type { Authenticators, InferAuthEvents, InferAuthenticators } from "@adonisjs/auth/types";

import env from "#start/env";

/**
 * The remember-me cookie is named after the guard (`remember_<guard>`), and staging shares the
 * cookie domain with production, so staging gets a guard of its own. Only ever the default guard
 * is used: `ctx.auth.use()`.
 */
function webGuard() {
  return sessionGuard({
    useRememberMeTokens: true,
    rememberMeTokensAge: "1 year",
    provider: sessionUserProvider({
      model: () => import("#models/user"),
    }),
  });
}

const authConfig = defineConfig({
  default: env.get("API_ENV") === "staging" ? "web_staging" : "web",
  guards: {
    web: webGuard(),
    web_staging: webGuard(),
  },
});

export default authConfig;

declare module "@adonisjs/auth/types" {
  export interface Authenticators extends InferAuthenticators<typeof authConfig> {}
}
declare module "@adonisjs/core/types" {
  interface EventsList extends InferAuthEvents<Authenticators> {}
}
