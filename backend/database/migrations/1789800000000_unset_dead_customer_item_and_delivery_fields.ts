import { BaseSchema } from "@adonisjs/lucid/schema";

/**
 * Removes three legacy fields nothing has ever read (survey of staging, 2026-09-18):
 * - `customerItem.totalAmount`: the order line amount, copied at creation (152k docs).
 *   `amountLeftToPay` next to it is the one the invoice and stand-cart flows use.
 * - `customerItem.handoutInfo.handoutBy` and `returnInfo.returnedTo`: single-value enums that
 *   were "branch" on every document. `handoutById` / `returnedToId` carry the information.
 * - `delivery.info.taxAmount`: the VAT share of the Bring price, written at checkout (35k docs).
 * The schemas and shared types no longer declare them.
 */
export default class extends BaseSchema {
  override async up() {
    // Changed MongoDB only; emptied when MongoDB was decommissioned (2026-09-28).
  }

  override async down() {
    // Removal of dead fields; there is nothing sensible to revert to.
  }
}
