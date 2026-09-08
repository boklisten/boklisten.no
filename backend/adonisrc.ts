import { defineConfig } from "@adonisjs/core/app";
import { indexEntities } from "@adonisjs/core";
import { generateRegistry } from "@tuyau/core/hooks";

export default defineConfig({
  commands: [() => import("@adonisjs/core/commands"), () => import("@adonisjs/lucid/commands")],
  providers: [
    () => import("@adonisjs/core/providers/app_provider"),
    () => import("@adonisjs/core/providers/hash_provider"),
    {
      file: () => import("@adonisjs/core/providers/repl_provider"),
      environment: ["repl", "test"],
    },
    () => import("@adonisjs/core/providers/vinejs_provider"),
    () => import("@adonisjs/cors/cors_provider"),
    () => import("@adonisjs/ally/ally_provider"),
    () => import("@adonisjs/static/static_provider"),
    () => import("@adonisjs/lucid/database_provider"),
    () => import("@adonisjs/limiter/limiter_provider"),
    () => import("#providers/api_provider"),
  ],

  preloads: [
    () => import("#start/instrument"),
    () => import("#start/routes"),
    () => import("#start/kernel"),
    {
      file: () => import("#start/mongoose"),
      environment: ["web"],
    },
    () => import("#start/profiler"),
    () => import("#start/sendgrid"),
    () => import("#start/validator"),
  ],

  tests: {
    suites: [
      {
        files: ["tests/**/*.spec.ts"],
        name: "unit",
        timeout: 2000,
      },
    ],
    forceExit: false,
  },
  metaFiles: [
    {
      pattern: "public/**",
      reloadServer: false,
    },
    {
      pattern: "resources/fonts/**",
      reloadServer: false,
    },
  ],
  hooks: {
    init: [
      indexEntities({
        transformers: { enabled: true },
      }),
      generateRegistry(),
    ],
  },
});
