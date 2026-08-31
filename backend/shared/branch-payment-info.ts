import { Period } from "#shared/period";

export interface BranchPaymentInfo {
  responsible: boolean; // if set the branch is responsible for payment, not the customer
  responsibleForDelivery?: boolean; // if set the customer does not need to pay for the delivery
  partlyPaymentPeriods?: {
    type: Period;
    date: Date;
    percentageBuyout: number; // item.price * this desides what the customer must pay on buyout
    percentageBuyoutUsed: number; // same as percentageBuyout but for when the item is used
    percentageUpFront: number; // item.price * this desides what the customer needs to pay upfront
    percentageUpFrontUsed: number; // same as percentageUpFront but for when teh item is used
  }[];
  rentPeriods: {
    type: Period; // the allowed period
    date: Date;
    maxNumberOfPeriods: number; // max number of periods of this type one item can be rented
    percentage: number; //the percentage of the item.price the rent price is
  }[];
  extendPeriods: {
    type: Period; //the possible extend period type
    date: Date;
    maxNumberOfPeriods: number; // the max number of periods this item can be extended
    price: number; // the price of the extend period
    percentage?: number | undefined; //if set then use percentage of item
  }[];
  buyout?: {
    // buyout needs only to be described when rent is possible
    percentage: number; //the percentage of the item.price it costs for the customer to buyout a item
  };
  sell?: {
    // information about when customer sells items to branch
    percentage: number; // the percentage of the full price the branch buys the item in for
  };
}
