import { defineConfig, targets } from "@adonisjs/core/logger";
import app from "@adonisjs/core/services/app";

import env from "#start/env";
import type { InferLoggers } from "@adonisjs/core/types";

const loggerConfig = defineConfig({
  default: "app",

  loggers: {
    app: {
      enabled: true,
      name: "backend",
      level: env.get("LOG_LEVEL"),
      transport: {
        targets: targets()
          .pushIf(!app.inProduction, targets.pretty())
          .pushIf(app.inProduction, targets.file({ destination: 1 }))
          .toArray(),
      },
    },
  },
});

export default loggerConfig;

declare module "@adonisjs/core/types" {
  export interface LoggersList extends InferLoggers<typeof loggerConfig> {}
}
