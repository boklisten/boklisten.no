import { defineConfig, drivers } from "@adonisjs/core/encryption";

import { appKey } from "#config/app";

export default defineConfig({
  default: "chacha",
  list: {
    chacha: drivers.chacha20({
      id: "chacha",
      keys: [appKey],
    }),
  },
});
