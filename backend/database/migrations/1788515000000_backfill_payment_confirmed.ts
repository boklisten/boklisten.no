import { BaseSchema } from "@adonisjs/lucid/schema";

/**
 * A handful of bl-api-era payments (22 on staging) lack the `confirmed` flag entirely.
 * The schema now declares `confirmed` with default `false` and the shared Payment type
 * declares it non-optional, so the stragglers get their schema default. Code only ever
 * read the flag as truthy, so `missing` and `false` were already equivalent.
 */
export default class extends BaseSchema {
  override async up() {
    // Changed MongoDB only; emptied when MongoDB was decommissioned (2026-09-28).
  }

  override async down() {
    // Data normalization toward the declared schema; there is nothing sensible to revert to.
  }
}
