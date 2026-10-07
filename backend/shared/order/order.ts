import type { OrderItemType } from "#shared/order/order-item/order-item-type";
import type { Period } from "#shared/period";

/**
 * An order: what a customer (or an employee on their behalf) asked for, and whether it is placed
 * (paid, or nothing to pay, and confirmed). This is the API shape of a row in `orders` with its
 * lines, as `Order.toDto()` produces it.
 */
export interface Order {
  id: string;
  /** The total of the lines, in NOK. */
  amount: number;
  branchId: string;
  /** Null when the customer's account has been deleted; the order outlives it as book history. */
  customerId: string | null;
  /** True when the customer placed the order themselves, false when an employee did. */
  byCustomer: boolean;
  employeeId: string | null;
  placed: boolean;
  /** False when the order was placed with the receipt e-mail switched off. */
  notifyByEmail: boolean;
  /** Vipps session state of the order's payment request, when one was made. */
  checkoutState: string | null;
  createdAt: Date;
  updatedAt: Date;
  orderItems: OrderItem[];
}

/** One line of an order: an operation (rent, buy, return, …) on one book. */
export interface OrderItem {
  id: number;
  type: OrderItemType;
  itemId: string;
  /** The book's current catalogue title. */
  title: string;
  isbn: string | null;
  blid: string | null;
  /** What the customer pays for this line, in NOK. */
  amount: number;
  unitPrice: number;
  /** The book was sent to the customer. */
  delivered: boolean;
  /** This line is the handout of the book. */
  handout: boolean;
  customerItemId: string | null;
  /** The rental or extension period, for rent, extend and partly-payment lines. */
  periodFrom: Date | null;
  /** `YYYY-MM-DD`. The deadline the line sets. */
  periodTo: string | null;
  numberOfPeriods: number | null;
  periodType: Period | null;
  amountLeftToPay: number | null;
  buybackAmount: number | null;
  /** The line was carried on from this earlier order. */
  movedFromOrderId: string | null;
  /** The line was carried on into this later order. */
  movedToOrderId: string | null;
}
