import type { BlDocument } from "#shared/bl-document";
import type { CustomerItemType } from "#shared/customer-item/customer-item-type";
import type { Period } from "#shared/period";

/**
 * A CustomerItem is an item that the customer is holding, either by renting
 * or by only paid part of full amount (partly payment).
 * It holds information about the rental period such as the deadline.
 * it can either be handed out by a Branch or another Customer.
 */
export interface CustomerItem extends BlDocument {
  item: string; // what item is this customerItem for
  blid?: string; // the unique id for this customer item
  type: CustomerItemType; // type is used to determine how to handle the customerItem
  customer: string; // the id/or the customer
  deadline: Date; //the deadline to return (or buyout if type is "partly-payment") this item
  handout: boolean; // if this customerItem is handed out to customer or not
  handoutInfo?: {
    handoutBy: "branch";
    handoutById: string; // the id of the branch that handed out the item
    handoutEmployee?: string; // the id of the employee that handed out the item
    time: Date; // the time this item was handed out
  };

  returned: boolean; // if this item is returned or not
  returnInfo?: {
    returnedTo: "branch";
    returnedToId: string; // the id of the branch the item was returned to
    returnEmployee?: string; // the id of the employee that received the item
    time: Date; //the time of return
  };

  buyout?: boolean; // if customerItem was bought out this is set to true
  buyoutInfo?: {
    order?: string; // the id of the order made when buyout
    time?: Date;
  };

  cancel?: boolean;
  cancelInfo?: {
    order?: string;
    time: Date;
  };

  buyback?: boolean;
  buybackInfo?: {
    order: string;
  };

  orders?: string[]; // what orders are this customerItem a part of, must be at least one, the order placement

  //--------- When type is "partly-payment"
  // when the deadline is approaching the customer can buyout the item
  // the amount to pay on buyout is the amount in "amountLeftToPay"
  amountLeftToPay?: number; // the amount left to pay on this customerItem (only if type is partly-payment),
  totalAmount?: number; // the total amount that should be payed (only if type is partly-payent)
  // ---------

  periodExtends?: {
    from: Date; // the old deadline
    to: Date; // the new deadline
    periodType: Period; //what type of period this extend is
    time: Date; // time this extend was made
  }[];

  customerInfo?: {
    // the customer info that was available at creation (this info can not be changed)
    name: string;
    phone: string;
    address: string;
    postCode: string;
    postCity: string;
    dob: Date;
    guardian?: {
      name: string;
      phone: string;
      email: string;
    };
  };
}
