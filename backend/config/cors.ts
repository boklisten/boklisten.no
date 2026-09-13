import { defineConfig } from "@adonisjs/cors";

import env from "#start/env";

const corsConfig = defineConfig({
  enabled: true,
  origin: env.get("URI_WHITELIST").split(" "),
  methods: ["HEAD", "GET", "PUT", "PATCH", "POST", "DELETE"],
  headers: true,
  exposeHeaders: ["retry-after", "x-ratelimit-reset"],
  credentials: true,
  maxAge: 90,
});

export default corsConfig;
