import { BaseSchema } from "@adonisjs/lucid/schema";

/**
 * Removes `orders.handoutByDelivery`. Whether the books of an order went by mail is now read off
 * the order's delivery document (method "bring"), which is how bl-admin has recorded postal
 * handouts since 2020 and what the stand cart copies.
 *
 * Staging survey, 2026-09-10: the flag was set on 652 orders, all employee handout orders from
 * 2018–2020. 437 of them also carry a Bring delivery and keep reading as postal; 169 point at a
 * delivery document that is gone and 45 never had one — those read as plain stand handouts from
 * now on, since nothing else about them is known.
 */
export default class extends BaseSchema {
  override async up() {
    // Changed MongoDB only; emptied when MongoDB was decommissioned (2026-09-28).
  }

  override async down() {
    // The flag carried no information the delivery document does not; there is nothing to restore.
  }
}
