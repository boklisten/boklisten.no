import { BaseSchema } from "@adonisjs/lucid/schema";

/**
 * Normalizes legacy bl-api-era Mongo data that current queries stumble over:
 *
 * - `customeritems.cancel` and `.buyback` are missing on 2018-era documents, so equality
 *   filters like `{ cancel: false }` (ACTIVE_CUSTOMER_ITEM_MATCH, the public blid lookup,
 *   reminders, reports) silently skip them. They get their schema default `false`.
 * - `customeritems.returnInfo.time` was written as an ISO string until 2018; the schema
 *   declares a Date.
 * - `orders.orderItems.info.to`/`.from` hold date strings for every order placed through a
 *   JSON request body, because `info` was a Mixed field with no casting — mixed with real
 *   BSON dates from backend-constructed orders, which breaks sorting and range filters and
 *   forces `$convert` in every aggregation. The schema now casts new writes to Date
 *   (order.schema.ts), and this migration converts the backlog.
 *
 * Unparseable strings (none observed on staging) are left as they are rather than failing
 * the deploy; leftovers are counted and logged.
 */
export default class extends BaseSchema {
  override async up() {
    // Changed MongoDB only; emptied when MongoDB was decommissioned (2026-09-28).
  }

  override async down() {
    // Data normalization toward the declared schemas; there is nothing sensible to revert to.
  }
}
