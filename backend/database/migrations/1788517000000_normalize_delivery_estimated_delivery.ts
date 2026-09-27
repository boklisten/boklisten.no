import { BaseSchema } from "@adonisjs/lucid/schema";

/**
 * A single delivery from May 2021 stored info.estimatedDelivery as an ISO string instead of a
 * Date. The delivery schema now declares info as a typed subdocument with estimatedDelivery as
 * Date, and the shared DeliveryInfoBring type declares `Date | null` — convert the stray string
 * so the data matches.
 */
export default class extends BaseSchema {
  override async up() {
    // Changed MongoDB only; emptied when MongoDB was decommissioned (2026-09-28).
  }

  override async down() {
    // Data normalization toward the declared schema; there is nothing sensible to revert to.
  }
}
