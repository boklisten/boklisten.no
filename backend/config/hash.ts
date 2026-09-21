import { defineConfig, drivers } from "@adonisjs/core/hash";
import type { InferHashers } from "@adonisjs/core/types";

const hashConfig = defineConfig({
  default: "argon",

  list: {
    argon: drivers.argon2({
      version: 0x13, // hex code for 19
      variant: "id",
      iterations: 3,
      memory: 65_536,
      parallelism: 4,
      saltSize: 16,
      hashLength: 32,
    }),
  },
});

export default hashConfig;

/**
 * Inferring enums for the list of hashers you have configured
 * in your application.
 */
declare module "@adonisjs/core/types" {
  export interface HashersList extends InferHashers<typeof hashConfig> {}
}
