import { DateTime } from "luxon";

import BadRequestException from "#exceptions/bad_request_exception";
import CustomerItem from "#models/customer_item";
import type { CustomerItem as CustomerItemDto } from "#shared/customer-item/customer-item";

interface ActiveItemCorrection {
  customerItemId: string;
  /** `YYYY-MM-DD`. */
  deadline?: string | undefined;
  branchId?: string | undefined;
}

/**
 * The one write behind every correction of a held book, from Boksøk and from the stand cart.
 * A deliberate data correction: only the customer item is touched, the orders behind it stay.
 * Whether and how the change is reported is the caller's business.
 */
export const ActiveItemCorrections = {
  /** Writes the correction and returns the book as it was, for the report. */
  async write({
    customerItemId,
    deadline,
    branchId,
  }: ActiveItemCorrection): Promise<CustomerItemDto> {
    const customerItem = await CustomerItem.find(customerItemId);
    if (!customerItem?.isActive) {
      throw new BadRequestException("Boka er ikke aktivt utdelt");
    }
    // The values before the write, so the report can say what they were.
    const previous = customerItem.toDto();
    if (deadline) {
      customerItem.deadline = DateTime.fromISO(deadline);
    }
    if (branchId) {
      customerItem.handoutBranchId = branchId;
    }
    await customerItem.save();
    return previous;
  },
};
