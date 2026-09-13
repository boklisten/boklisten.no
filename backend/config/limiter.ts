import { defineConfig, stores } from "@adonisjs/limiter";
import type { InferLimiters } from "@adonisjs/limiter/types";

const limiterConfig = defineConfig({
  default: "database",
  stores: {
    database: stores.database({
      tableName: "rate_limits",
    }),
    /** For unit tests of code that counts with a limiter; nothing in production uses it. */
    memory: stores.memory({}),
  },
});

export default limiterConfig;

declare module "@adonisjs/limiter/types" {
  export interface LimitersList extends InferLimiters<typeof limiterConfig> {}
}
