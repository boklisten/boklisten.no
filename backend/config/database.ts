import { defineConfig } from "@adonisjs/lucid";
import { types } from "pg";

import env from "#start/env";

// `date` columns come back as their plain `yyyy-MM-dd` text instead of a JS Date at the process's
// local midnight, so a calendar day never shifts with the server's time zone. Lucid's
// `@column.date()` reads that text into a Luxon date in the app's default zone.
types.setTypeParser(types.builtins.DATE, (value) => value);
// `decimal` columns (invoice amounts, at most eight digits before the point) come back as numbers
// instead of text; they fit a JS number exactly to the øre.
types.setTypeParser(types.builtins.NUMERIC, Number);

const dbConfig = defineConfig({
  connection: "postgres",
  connections: {
    postgres: {
      client: "pg",
      connection: env.get("POSTGRES_URL").release(),
      migrations: {
        naturalSort: true,
        paths: ["database/migrations"],
      },
      schemaGeneration: {
        rulesPaths: ["#database/schema_rules"],
      },
    },
  },
});

export default dbConfig;
