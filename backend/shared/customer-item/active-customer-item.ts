import { CustomerItemType } from "#shared/customer-item/customer-item-type";

/** A book a customer is currently holding, as shown to employees at the stand. */
export interface ActiveCustomerItem {
  id: string;
  title: string;
  blid: string | null;
  type: CustomerItemType | null;
  deadline: Date;
}
