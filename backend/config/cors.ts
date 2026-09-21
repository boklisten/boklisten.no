import { defineConfig } from "@adonisjs/cors";

import { clientOrigin } from "#config/app";

const corsConfig = defineConfig({
  enabled: true,
  origin: [clientOrigin],
  methods: ["HEAD", "GET", "PUT", "PATCH", "POST", "DELETE"],
  headers: true,
  exposeHeaders: ["retry-after", "x-ratelimit-reset"],
  credentials: true,
  maxAge: 90,
});

export default corsConfig;
