import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import { sentryTanstackStart } from "@sentry/tanstackstart-react/vite";

/**
 * Where this build will run. Railway sets the environment's name and the API service's domain
 * for every build; anything else is a developer's machine talking to the local backend.
 */
const railwayEnvironment = process.env["RAILWAY_ENVIRONMENT_NAME"];
const apiDomain = process.env["RAILWAY_SERVICE_API_BOKLISTEN_NO_URL"];
if (railwayEnvironment && !apiDomain) {
  throw new Error(
    "RAILWAY_SERVICE_API_BOKLISTEN_NO_URL is not set; Railway injects it from the API service",
  );
}

export default defineConfig({
  define: {
    "import.meta.env.VITE_APP_ENV": JSON.stringify(railwayEnvironment ?? "dev"),
    "import.meta.env.VITE_API_URL": JSON.stringify(
      apiDomain ? `https://${apiDomain}` : "http://localhost:3333",
    ),
  },
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    tanstackStart(),
    nitro({
      preset: "bun",
      routeRules: {
        // Static images are not content-hashed, so cache them for a day and
        // serve stale while revalidating instead of caching forever.
        "/images/**": {
          headers: {
            "cache-control": "public, max-age=86400, stale-while-revalidate=604800",
          },
        },
      },
    }),
    react({ compiler: true }),
    sentryTanstackStart({
      org: "boklisten",
      project: "frontend",
      authToken: process.env["SENTRY_AUTH_TOKEN"],
    }),
  ],
});
