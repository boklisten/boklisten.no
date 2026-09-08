import { ObjectId } from "mongodb";

import BadRequestException from "#exceptions/bad_request_exception";
import { ACTIVE_CUSTOMER_ITEM_MATCH } from "#services/branch_books_service";
import { StorageService } from "#services/storage_service";
import type { CustomerItem } from "#shared/customer-item/customer-item";

export interface ActiveItemCorrection {
  customerItemId: string;
  deadline?: Date | undefined;
  branchId?: string | undefined;
}

/**
 * The one write behind every correction of a held book, from Boksøk and from the stand cart.
 * A deliberate data correction: only the customer item is touched, the orders behind it stay.
 * Whether and how the change is reported is the caller's business.
 */
export const ActiveItemCorrections = {
  /** Writes the correction and returns the book as it was, for the report. */
  async write({ customerItemId, deadline, branchId }: ActiveItemCorrection): Promise<CustomerItem> {
    // Read before writing so the report can say what the values were.
    const previous = await StorageService.CustomerItems.getOrNull(customerItemId);
    const set: Record<string, unknown> = { lastUpdated: new Date() };
    if (deadline) {
      set["deadline"] = deadline;
    }
    if (branchId) {
      // handoutInfo may be missing entirely on legacy items; set both keys so the pair
      // stays coherent.
      set["handoutInfo.handoutBy"] = "branch";
      set["handoutInfo.handoutById"] = new ObjectId(branchId);
    }
    const result = await StorageService.CustomerItems.updateMany(
      {
        _id: new ObjectId(customerItemId),
        ...ACTIVE_CUSTOMER_ITEM_MATCH,
        buyback: { $ne: true },
      },
      { $set: set },
    );
    if (result.matchedCount === 0 || !previous) {
      throw new BadRequestException("Boka er ikke aktivt utdelt");
    }
    return previous;
  },
};
