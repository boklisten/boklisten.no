import { ObjectId } from "mongodb";

import { StorageService } from "#services/storage_service";
import type { CustomerItem } from "#shared/customer-item/customer-item";
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
  const equivalentItemIds = getEquivalentItemIds(itemId);

  const remaining = (await StorageService.CustomerItems.aggregate([
    {
      $match: {
        customer: new ObjectId(customerId),
        item: { $in: equivalentItemIds.map((id) => new ObjectId(id)) },
        returned: false,
        buyout: false,
        cancel: false,
        buyback: false,
      },
    },
  ])) as CustomerItem[];

  await Promise.all(
    remaining
      .filter((customerItem) => new Date(customerItem.deadline) < releasedDeadline)
      .map((customerItem) =>
        StorageService.CustomerItems.update(customerItem.id, { deadline: releasedDeadline }),
      ),
  );
}
