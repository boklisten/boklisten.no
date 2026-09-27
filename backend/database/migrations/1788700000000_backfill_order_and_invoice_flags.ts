import { BaseSchema } from "@adonisjs/lucid/schema";

/**
 * Backfills boolean flags that the shared types now declare non-optional (staging counts
 * per the 2026-09-01 survey):
 *
 * - orders.handoutByDelivery: missing on 85 573 of 183 991 — writers other than bl-admin
 *   never set it (still omitted on orders created today); the schema now defaults it to false.
 * - orders.orderItems[].handout: missing somewhere on 81 782 orders — same open tap, same fix.
 * - orders.orderItems[].delivered: missing on 4 orders from 2018 (schema default has covered
 *   every create since).
 * - invoices.toLossNote: missing on 4 125 of 7 734 — all created before the schema default
 *   arrived in 2022.
 *
 * Absent has always meant false for every one of these (readers only do truthy checks),
 * so the backfill changes no behavior — it makes the data match the declared types.
 */
export default class extends BaseSchema {
  override async up() {
    // Changed MongoDB only; emptied when MongoDB was decommissioned (2026-09-28).
  }

  override async down() {
    // Data normalization toward the declared schema; there is nothing sensible to revert to.
  }
}
