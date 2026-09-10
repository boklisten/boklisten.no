import type { OrderHistoryEntry } from "#shared/order/order-history";
import type { Period } from "#shared/period";

/**
 * Where a cart line comes from. A line is unique by its source, not by book: two copies of the
 * same title are two lines, each with its own blid.
 */
export type StandCartSource =
  /** A book the customer has ordered but not yet been handed. */
  | { kind: "order"; orderId: string; itemId: string }
  /** A book the customer is holding. */
  | { kind: "customerItem"; customerItemId: string }
  /** A scanned copy the customer never ordered and does not hold. */
  | { kind: "item"; itemId: string; blid: string };

/** What a resolve request may point at: a line source, or a bare scan the server places. */
export type StandCartLookup = StandCartSource | { kind: "blid"; blid: string };

/** Unique within a cart, and the same on both sides of the API. */
export function lineKey(source: StandCartSource): string {
  switch (source.kind) {
    case "order": {
      return `order:${source.orderId}:${source.itemId}`;
    }
    case "customerItem": {
      return `customerItem:${source.customerItemId}`;
    }
    case "item": {
      return `item:${source.blid}`;
    }
    default: {
      throw new Error(`unknown source ${JSON.stringify(source)}`);
    }
  }
}

export const STAND_CART_ACTION_TYPES = [
  "rent",
  "partly-payment",
  "buy",
  "sell",
  "cancel",
  "return",
  "buyback",
  "extend",
  "buyout",
] as const;
export type StandCartActionType = (typeof STAND_CART_ACTION_TYPES)[number];

/** The actions that hand a physical copy to the customer. */
export const HANDOUT_ACTION_TYPES: StandCartActionType[] = ["rent", "partly-payment", "buy"];

/** The handouts that must carry a scanned copy before submit; a buy may go out unscanned. */
export const BLID_REQUIRED_ACTION_TYPES: StandCartActionType[] = ["rent", "partly-payment"];

/** A handout that cannot go through without a scanned copy, and none is in hand yet. */
export function needsBlid(blid: string | null, type: StandCartActionType): boolean {
  return blid === null && BLID_REQUIRED_ACTION_TYPES.includes(type);
}

export function unlinkedBlidMessage(blid: string): string {
  return `Unik ID ${blid} er ikke koblet til noen bok`;
}

/**
 * One concrete thing the employee can pick for a line. Actions that carry a period have one
 * option per period the branch offers.
 */
export interface StandCartOption {
  type: StandCartActionType;
  /** ISO timestamp of the period end, for actions that carry a period. */
  to?: string;
  periodType?: Period;
  /** What the customer pays now; negative when money goes back to the customer. */
  price: number;
  /** Partly-payment: what is left to pay at the deadline. */
  payLater?: number;
  /** False when a rule blocks the option outright; `reason` says why. */
  available: boolean;
  /** True when picking it is reported to the administrator; `reason` says why. */
  monitored: boolean;
  reason?: string;
}

export type StandCartNote =
  /** The customer is due to get this book from another student. */
  | { kind: "peer-match"; deliverFromName: string }
  /** The order was placed on another branch than the cart's. */
  | { kind: "other-branch"; branchName: string }
  /** The original order is to be sent by mail. */
  | { kind: "bring-delivery" }
  /** The customer already paid this much for the book online. */
  | { kind: "prepaid"; amount: number };

export interface StandCartLine {
  key: string;
  source: StandCartSource;
  itemId: string;
  title: string;
  blid: string | null;
  options: StandCartOption[];
  defaultOptionIndex: number;
  /** Why the line offers nothing at all; set exactly when `options` is empty. */
  unavailableReason: string | null;
  /** The order's branch, or the branch the book was handed out from. */
  originalBranch: { id: string; name: string } | null;
  notes: StandCartNote[];
}

/** What the employee picked for a line: an option's type and period end. */
export interface StandCartChoice {
  type: StandCartActionType;
  /** ISO timestamp. */
  to?: string;
}

/** Period ends are compared as Oslo calendar days, so a date picked in a form matches the branch period. */
function osloDay(iso: string): string {
  return new Date(iso).toLocaleDateString("sv-SE", { timeZone: "Europe/Oslo" });
}

/** The option behind the employee's pick; null when the line offers nothing of the kind. */
export function findOption(
  line: Pick<StandCartLine, "options">,
  choice: StandCartChoice,
): StandCartOption | null {
  return (
    line.options.find(
      (option) =>
        option.type === choice.type &&
        (option.to === undefined || choice.to === undefined
          ? option.to === choice.to
          : osloDay(option.to) === osloDay(choice.to)),
    ) ?? null
  );
}

export type StandCartResolveResult =
  | { kind: "line"; line: StandCartLine }
  /** The blid is not linked to any book yet. */
  | { kind: "unlinked"; blid: string }
  /** The scan or click cannot become a line; the message says why. */
  | { kind: "refused"; message: string };

/** The obstacles the employee can knowingly override at submit. */
export const STAND_CART_CONFIRMATIONS = ["peer-match", "missing-signature"] as const;
export type StandCartConfirmation = (typeof STAND_CART_CONFIRMATIONS)[number];

/**
 * How the money moves at checkout. For an amount to pay: cash or card on the employee's word, or
 * a Vipps request pushed to the phone number. For a refund: back on the Vipps transactions the
 * customer paid with, or by the administrator's bank transfer to the account number given.
 */
export type StandCartCheckoutPayment =
  | { method: "cash" | "card" }
  | { method: "vipps"; phoneNumber?: string | undefined }
  | { method: "vipps-refund" }
  | { method: "bank-transfer"; accountNumber: string; comment: string | null };

/** The Vipps payment methods that leave a transaction the ePayment API can refund. */
export type RefundableVippsMethod = "vipps-checkout" | "vipps-epayment";

/** One Vipps transaction that a refund goes back on, and how much of the refund it takes. */
export interface StandCartVippsRefund {
  /** The paid order; its id is the Vipps reference. */
  orderId: string;
  method: RefundableVippsMethod;
  /** Positive: what goes back to the customer on this transaction. */
  amount: number;
}

/**
 * How a cart's refund goes back to the customer: automatically on the Vipps transactions that
 * were paid, or by hand from the administrator when any of the money did not come through Vipps.
 */
export type StandCartRefundPlan =
  | { kind: "vipps"; refunds: StandCartVippsRefund[] }
  | { kind: "manual"; reasons: string[] };

export type StandCartCheckoutStatus =
  /** Vipps: the request is out, the customer has not answered. */
  | "pending"
  /** Placed and paid. */
  | "paid"
  /** Placed without payment: nothing to pay. */
  | "placed"
  | "aborted"
  | "expired"
  | "cancelled";

export interface StandCartCheckoutState {
  status: StandCartCheckoutStatus;
  orderId: string;
  /** The receipt, once the order is placed. */
  order: OrderHistoryEntry | null;
}
