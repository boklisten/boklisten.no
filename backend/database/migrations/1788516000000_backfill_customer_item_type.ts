import { BaseSchema } from "@adonisjs/lucid/schema";

/**
 * CustomerItems created before `type` existed (Aug 2018 - Jan 2019, 3 503 on staging) lack the
 * field. Partly-payment first appears Jan 10 2019 — right when `type` started being written —
 * and none of the type-less documents carry the partly-payment markers (amountLeftToPay,
 * totalAmount), so they are all rentals. The schema now declares `type` required, and the
 * shared CustomerItem type declares it non-optional.
 */
export default class extends BaseSchema {
  override async up() {
    // Changed MongoDB only; emptied when MongoDB was decommissioned (2026-09-28).
  }

  override async down() {
    // Data normalization toward the declared schema; there is nothing sensible to revert to.
  }
}
