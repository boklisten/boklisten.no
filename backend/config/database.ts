import { defineConfig } from "@adonisjs/lucid";
import { types } from "pg";

import env from "#start/env";

// `date` columns come back as their plain `yyyy-MM-dd` text instead of a JS Date at the process's
// local midnight, so a calendar day never shifts with the server's time zone. Lucid's
// `@column.date()` reads that text into a Luxon date in the app's default zone.
types.setTypeParser(types.builtins.DATE, (value) => value);

const dbConfig = defineConfig({
  connection: "postgres",
  connections: {
    postgres: {
      client: "pg",
      connection: env.get("POSTGRES_URL"),
      migrations: {
        naturalSort: true,
        paths: ["database/migrations"],
      },
    },
  },
});

export default dbConfig;
