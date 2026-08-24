import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import { sentryTanstackStart } from "@sentry/tanstackstart-react/vite";

export default defineConfig({
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
