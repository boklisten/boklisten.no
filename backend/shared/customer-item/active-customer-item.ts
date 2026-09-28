import type { CustomerItemAction } from "#shared/customer-item/actionable_customer_item";
import type { CustomerItemType } from "#shared/customer-item/customer-item-type";

/** A book a customer is currently holding, as shown to employees at the stand. */
export interface ActiveCustomerItem {
  id: string;
  /** Id of the item this is a copy of, for pairing with match obligations. */
  item: string;
  title: string;
  blid: string | null;
  type: CustomerItemType;
  /** `YYYY-MM-DD`. */
  deadline: string;
  /** The branch the book was handed out from. */
  handoutBranch: { id: string; name: string };
  /** Extension and buyout, priced and gated by the same rules the customer sees. */
  actions: CustomerItemAction[];
}
