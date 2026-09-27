import type { SchemaRules } from "@adonisjs/lucid/types/schema_generator";

/**
 * Rules for the generated `database/schema.ts`. `decimal` columns (invoice amounts in kroner and
 * øre) are read as numbers by the pg type parser in `config/database.ts`, so they are typed as
 * numbers here too.
 */
export default {
  types: {
    decimal: { tsType: "number", decorators: [{ name: "@column" }] },
  },
} satisfies SchemaRules;
