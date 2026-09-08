import type { DateTime } from "luxon";

import { isHandedOutWithinTheLastTwoWeeks } from "#services/customer_item_actions_service";
import type { CustomerItem } from "#shared/customer-item/customer-item";
import { isDeadlineOverdue } from "#shared/deadline";

/**
 * When an action on a held book is outside the rules, and why. Pricing warns the employee with
 * these reasons and monitoring reports them, so the two can never disagree. Null means the
 * action is ordinary.
 */
export const HeldBookRules = {
  /** Handing a book back after its deadline. */
  takeBack(customerItem: CustomerItem, now: Date): string | null {
    return isDeadlineOverdue(customerItem.deadline, now) ? "Fristen for boka har gått ut" : null;
  },

  /** Undoing a handout is expected right after it, not weeks later. */
  cancel(customerItem: CustomerItem, now: DateTime): string | null {
    return isHandedOutWithinTheLastTwoWeeks(customerItem, now)
      ? null
      : "Boka ble delt ut for mer enn to uker siden, og skal normalt ikke kanselleres";
  },

  /** The customer could not have bought the book out themselves yet. */
  buyout(customerItem: CustomerItem, now: DateTime): string | null {
    return isHandedOutWithinTheLastTwoWeeks(customerItem, now)
      ? "Kunden må ha hatt boka i minst to uker for at den skal kunne kjøpes ut"
      : null;
  },
};
