import db from "@adonisjs/lucid/services/db";

import CustomerItem from "#models/customer_item";
import { getEquivalentItemIds } from "#shared/item-equivalence";

/**
 * After a customer parts with one of several copies of a title, the copies they keep take the
 * latest deadline of the group.
 *
 * A student finishing VG1 receives next year's Gymnos in June while still holding their own, and
 * parts with one of them in August. Whichever copy physically leaves, the one that stays must carry
 * the later deadline — otherwise handing over the long-dated copy would leave the student holding a
 * book that is instantly overdue, purely as an artefact of which barcode was scanned.
 *
 * Call this after the released copy has been marked returned, passing its deadline.
 */
export async function extendRemainingCopyDeadlines(
  customerId: string,
  itemId: string,
  releasedDeadline: Date,
) {
  await CustomerItem.whereActive(
    db
      .from("customer_items")
      .where("customer_id", customerId)
      .whereIn("item_id", getEquivalentItemIds(itemId))
      .where("deadline", "<", releasedDeadline),
  ).update({ deadline: releasedDeadline, updated_at: new Date() });
}
