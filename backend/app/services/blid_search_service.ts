import type { ObjectId } from "mongodb";

import BookHandover from "#models/book_handover";
import { ActiveItemMonitoring, FALLBACK_BRANCH_NAME } from "#services/active_item_monitoring";
import { ActiveItemCorrections } from "#services/active_item_corrections";
import { ACTIVE_CUSTOMER_ITEM_MATCH } from "#services/branch_books_service";
import type { MonitoredEmployee } from "#services/employee_monitoring_service";
import { isMonitored } from "#services/employee_monitoring_service";
import { findUniqueItemByBlid } from "#services/item_lookup";
import { BlSchemaName } from "#models/mongoose/storage/bl-schema-names";
import { SEDbQuery } from "#models/mongoose/storage/db-query";
import { StorageService } from "#services/storage_service";
import type {
  BlidActiveItem,
  BlidHistoryEvent,
  BlidParty,
  BlidSearchHit,
  BlidSearchResponse,
  BlidSearchResult,
  BlidStatus,
} from "#shared/blid_search";
import type { CustomerItem } from "#shared/customer-item/customer-item";
import type { CustomerItemType } from "#shared/customer-item/customer-item-type";
import type { Order } from "#shared/order/order";
import type { OrderItem } from "#shared/order/order-item/order-item";
import { USER_PERMISSION } from "#shared/user-permission";

export interface HandoverRow {
  fromUserDetailId: string | null;
  toUserDetailId: string | null;
  occurredAt: Date;
  orderId: string | null;
}

export interface BlidSearchSources {
  blid: string;
  item: { id: string; title: string; isbn: string } | null;
  /** Whether a unique item exists for the blid. */
  registered: boolean;
  /** When the unique item was created and last changed; null when it is gone or undated. */
  registration: { createdAt: Date; updatedAt: Date } | null;
  customerItems: CustomerItem[];
  orders: Order[];
  handovers: HandoverRow[];
  /** Orders whose delivery document is a Bring shipment: their handouts went by mail. */
  bringDeliveryOrderIds: Set<string>;
  /** User detail id → display name. */
  userDetails: Map<string, string>;
  branchNames: Map<string, string>;
  /** The moment the search runs, for judging whether the held book is overdue. */
  now: Date;
}

const FALLBACK_NAME = "Ukjent";

/**
 * Mongoose stamps creation and update in separate calls on insert, so the two drift by a
 * millisecond on untouched records; anything closer than this counts as never edited.
 */
const EDIT_TOLERANCE_MS = 1000;

/** Enough to fill the search dropdown; a longer text narrows the list instead. */
const SEARCH_HIT_LIMIT = 10;

/**
 * Where the text sits in the blid, best first; in each position a match in the typed casing beats
 * one that ignores it. Containing the text ignoring case is what the search matched on, so it is
 * the fallthrough tier rather than a branch.
 */
const MATCH_TIERS = [
  { anchor: "exact", caseSensitive: true },
  { anchor: "exact", caseSensitive: false },
  { anchor: "prefix", caseSensitive: true },
  { anchor: "prefix", caseSensitive: false },
  { anchor: "suffix", caseSensitive: true },
  { anchor: "suffix", caseSensitive: false },
  { anchor: "contains", caseSensitive: true },
] as const;

const ANCHORED_PATTERN: Record<(typeof MATCH_TIERS)[number]["anchor"], (query: string) => string> =
  {
    exact: (query) => `^${query}$`,
    prefix: (query) => `^${query}`,
    suffix: (query) => `${query}$`,
    contains: (query) => query,
  };

/**
 * The aggregation expression that ranks a blid against the typed text: the index of the first
 * tier it satisfies, lower being better.
 *
 * @param query Alphanumeric text (the validator guarantees no regex metacharacters).
 */
export function blidMatchTierExpression(query: string) {
  return {
    $switch: {
      branches: MATCH_TIERS.map((tier, index) => ({
        case: {
          $regexMatch: {
            input: "$blid",
            regex: ANCHORED_PATTERN[tier.anchor](query),
            ...(tier.caseSensitive ? {} : { options: "i" }),
          },
        },
        // oxlint-disable-next-line unicorn/no-thenable -- the key $switch requires
        then: index,
      })),
      default: MATCH_TIERS.length,
    },
  };
}

export interface BlidSearchHitSources {
  /** Already in the order they should be shown. */
  uniqueItems: { blid: string; title: string }[];
  /** blid → user detail id of the customer actively holding the book. */
  holders: Map<string, string>;
  /** User detail id → display name. */
  userDetails: Map<string, string>;
}

/** Attaches the holding customer to each matched book. */
export function assembleBlidSearchHits(sources: BlidSearchHitSources): BlidSearchHit[] {
  return sources.uniqueItems.map(({ blid, title }) => {
    const detailsId = sources.holders.get(blid);
    return {
      blid,
      title,
      holder:
        detailsId === undefined
          ? null
          : { detailsId, name: sources.userDetails.get(detailsId) ?? FALLBACK_NAME },
    };
  });
}

function isoOrUndefined(date: Date | undefined): string | undefined {
  return date === undefined ? undefined : new Date(date).toISOString();
}

function handoutTypeOf(orderItem: OrderItem | undefined): CustomerItemType | undefined {
  return orderItem?.type === "rent" || orderItem?.type === "partly-payment"
    ? orderItem.type
    : undefined;
}

export function collectReferencedIds(
  customerItems: CustomerItem[],
  orders: Order[],
  handovers: HandoverRow[],
): { userDetailIds: string[]; branchIds: string[] } {
  const userDetailIds = new Set<string>();
  const branchIds = new Set<string>();

  for (const customerItem of customerItems) {
    userDetailIds.add(customerItem.customer);
    const { handoutInfo, returnInfo } = customerItem;
    if (handoutInfo) {
      branchIds.add(handoutInfo.handoutById);
      if (handoutInfo.handoutEmployee) {
        userDetailIds.add(handoutInfo.handoutEmployee);
      }
    }
    if (returnInfo) {
      branchIds.add(returnInfo.returnedToId);
      if (returnInfo.returnEmployee) {
        userDetailIds.add(returnInfo.returnEmployee);
      }
    }
  }
  for (const order of orders) {
    userDetailIds.add(order.customer);
    if (order.employee) {
      userDetailIds.add(order.employee);
    }
    branchIds.add(order.branch);
  }
  for (const handover of handovers) {
    if (handover.fromUserDetailId) {
      userDetailIds.add(handover.fromUserDetailId);
    }
    if (handover.toUserDetailId) {
      userDetailIds.add(handover.toUserDetailId);
    }
  }

  return { userDetailIds: [...userDetailIds], branchIds: [...branchIds] };
}

// One physical transfer can leave three records made within moments of each other: the
// sender's order, the receiver's order, and (in modern data) the handover row.
const TRANSFER_PAIRING_WINDOW_MS = 120_000;

function sameCustomer(a: BlidParty | undefined, b: BlidParty | undefined): boolean {
  return a?.type === "customer" && b?.type === "customer" && a.detailsId === b.detailsId;
}

function withinPairingWindow(a: BlidHistoryEvent, b: BlidHistoryEvent): boolean {
  return Math.abs(Date.parse(a.time) - Date.parse(b.time)) <= TRANSFER_PAIRING_WINDOW_MS;
}

/**
 * Folds one-sided match order events (match-deliver knows only the sender, match-receive only
 * the receiver) into two-sided transfer events: pairs that describe the same moment merge, and
 * sides already told by an authoritative transfer are dropped.
 */
function reconcileOneSidedMatches(
  oneSidedMatches: BlidHistoryEvent[],
  transfers: BlidHistoryEvent[],
  events: BlidHistoryEvent[],
): void {
  // Matching either side marks a duplicate — including crosswise: a double scan can record a
  // deliver in the receiver's own name (nobody hands the book onward the moment they get it).
  const duplicatesTransfer = (event: BlidHistoryEvent) =>
    transfers.some(
      (transfer) =>
        withinPairingWindow(event, transfer) &&
        (sameCustomer(event.from, transfer.from) ||
          sameCustomer(event.to, transfer.to) ||
          sameCustomer(event.from, transfer.to) ||
          sameCustomer(event.to, transfer.from)),
    );

  const receives = oneSidedMatches.filter((event) => event.to !== undefined);
  const delivers = oneSidedMatches.filter((event) => event.from !== undefined);
  const pairedDelivers = new Set<BlidHistoryEvent>();

  for (const receive of receives) {
    if (duplicatesTransfer(receive)) {
      continue;
    }
    const deliver = delivers.find(
      (candidate) =>
        !pairedDelivers.has(candidate) &&
        withinPairingWindow(receive, candidate) &&
        !sameCustomer(candidate.from, receive.to),
    );
    if (deliver) {
      pairedDelivers.add(deliver);
      const merged: BlidHistoryEvent = { ...receive, from: deliver.from };
      events.push(merged);
      transfers.push(merged);
    } else {
      events.push(receive);
      transfers.push(receive);
    }
  }
  for (const deliver of delivers) {
    if (pairedDelivers.has(deliver) || duplicatesTransfer(deliver)) {
      continue;
    }
    events.push(deliver);
    transfers.push(deliver);
  }
}

export function assembleBlidSearch(sources: BlidSearchSources): BlidSearchResult {
  const customerParty = (detailsId: string): BlidParty => ({
    type: "customer",
    detailsId,
    name: sources.userDetails.get(detailsId) ?? FALLBACK_NAME,
  });
  const employeeOf = (id: string | undefined) => {
    const name = id === undefined ? undefined : sources.userDetails.get(id);
    return id === undefined || name === undefined ? undefined : { detailsId: id, name };
  };
  const branchName = (id: string | undefined) =>
    id === undefined ? undefined : (sources.branchNames.get(id) ?? FALLBACK_NAME);
  const byMailOf = (order: Order | undefined) =>
    order !== undefined && sources.bringDeliveryOrderIds.has(order.id) ? true : undefined;

  const ordersById = new Map(sources.orders.map((order) => [order.id, order]));

  // Legacy order items (extends especially) often lack the blid but point at the customer
  // item instead, which pins them to this copy just as well.
  const customerItemIds = new Set(sources.customerItems.map((customerItem) => customerItem.id));
  const belongsToBlid = (orderItem: OrderItem) => {
    if (orderItem.blid === sources.blid) {
      return true;
    }
    const linkedCustomerItem = orderItem.info?.customerItem ?? orderItem.customerItem;
    return (
      orderItem.blid == null &&
      linkedCustomerItem != null &&
      customerItemIds.has(linkedCustomerItem)
    );
  };

  const events: BlidHistoryEvent[] = [];
  // Two-sided transfer events, used to recognize the bookkeeping records the same physical
  // handover leaves behind (each party's own order, the receiver's customer item).
  const transfers: BlidHistoryEvent[] = [];

  // Handover rows are the authoritative movement record: they know both parties.
  const orderIdsCoveredByHandover = new Set<string>();
  for (const handover of sources.handovers) {
    if (handover.fromUserDetailId === null && handover.toUserDetailId === null) {
      continue;
    }
    if (handover.orderId !== null) {
      orderIdsCoveredByHandover.add(handover.orderId);
    }

    const order = handover.orderId === null ? undefined : ordersById.get(handover.orderId);
    const relevantOrderItem = order?.orderItems.find(belongsToBlid);
    const action =
      handover.fromUserDetailId !== null && handover.toUserDetailId !== null
        ? "match-transfer"
        : handover.fromUserDetailId === null
          ? "handout"
          : "return";
    const event: BlidHistoryEvent = {
      time: new Date(handover.occurredAt).toISOString(),
      action,
      from:
        handover.fromUserDetailId === null
          ? { type: "stand" }
          : customerParty(handover.fromUserDetailId),
      to:
        handover.toUserDetailId === null
          ? { type: "stand" }
          : customerParty(handover.toUserDetailId),
      employee: employeeOf(order?.employee),
      byCustomer: order?.byCustomer ?? action === "match-transfer",
      branchName: branchName(order?.branch),
      deadline: isoOrUndefined(relevantOrderItem?.info?.to),
      handoutType: action === "handout" ? handoutTypeOf(relevantOrderItem) : undefined,
      byMail: action === "handout" ? byMailOf(order) : undefined,
      orderId: handover.orderId ?? undefined,
    };
    events.push(event);
    if (action === "match-transfer") {
      transfers.push(event);
    }
  }

  // Legacy match orders record only their own side; they are paired up after the loop.
  const oneSidedMatches: BlidHistoryEvent[] = [];
  for (const order of sources.orders) {
    // An unplaced order is an abandoned cart; nothing in it actually happened to the book.
    if (!order.placed) {
      continue;
    }
    for (const orderItem of order.orderItems) {
      if (!belongsToBlid(orderItem)) {
        continue;
      }

      let event: Pick<
        BlidHistoryEvent,
        "action" | "from" | "to" | "deadline" | "previousDeadline" | "handoutType" | "byMail"
      >;
      switch (orderItem.type) {
        case "rent":
        case "partly-payment": {
          if (!orderItem.handout) {
            continue;
          }
          event = {
            action: "handout",
            from: { type: "stand" },
            to: customerParty(order.customer),
            deadline: isoOrUndefined(orderItem.info?.to),
            handoutType: orderItem.type,
            byMail: byMailOf(order),
          };
          break;
        }
        case "return": {
          event = { action: "return", from: customerParty(order.customer), to: { type: "stand" } };
          break;
        }
        case "match-receive": {
          event = {
            action: "match-transfer",
            to: customerParty(order.customer),
            deadline: isoOrUndefined(orderItem.info?.to),
          };
          break;
        }
        case "match-deliver": {
          event = { action: "match-transfer", from: customerParty(order.customer) };
          break;
        }
        case "extend": {
          event = {
            action: "extend",
            to: customerParty(order.customer),
            previousDeadline: isoOrUndefined(orderItem.info?.from),
            deadline: isoOrUndefined(orderItem.info?.to),
          };
          break;
        }
        case "buyout": {
          event = { action: "buyout", to: customerParty(order.customer) };
          break;
        }
        case "invoice-paid": {
          event = { action: "invoice-paid", to: customerParty(order.customer) };
          break;
        }
        case "buyback": {
          event = { action: "buyback", from: customerParty(order.customer) };
          break;
        }
        case "cancel": {
          event = { action: "cancel", from: customerParty(order.customer) };
          break;
        }
        default: {
          continue;
        }
      }

      const isMovement =
        event.action === "handout" ||
        event.action === "return" ||
        event.action === "match-transfer";
      if (isMovement && orderIdsCoveredByHandover.has(order.id)) {
        continue;
      }

      const fullEvent: BlidHistoryEvent = {
        ...event,
        time: new Date(order.creationTime ?? 0).toISOString(),
        employee: employeeOf(order.employee),
        byCustomer: order.byCustomer,
        branchName: branchName(order.branch),
        orderId: order.id,
      };
      if (event.action === "match-transfer") {
        oneSidedMatches.push(fullEvent);
      } else {
        events.push(fullEvent);
      }
    }
  }

  reconcileOneSidedMatches(oneSidedMatches, transfers, events);

  // Customer items back-fill movements that predate both the handover table and blid-tagged
  // order items. A customer's handout/return is only synthesized when no event already tells
  // that story for the same customer — receiving via a transfer counts as having gotten the
  // book, and giving it away via a transfer counts as having parted with it.
  const gotBook = (detailsId: string) =>
    events.some(
      (event) =>
        (event.action === "handout" || event.action === "match-transfer") &&
        event.to?.type === "customer" &&
        event.to.detailsId === detailsId,
    );
  const gaveBook = (detailsId: string) =>
    events.some(
      (event) =>
        (event.action === "return" || event.action === "match-transfer") &&
        event.from?.type === "customer" &&
        event.from.detailsId === detailsId,
    );
  const extendDeadlines = new Set(
    events
      .filter((event) => event.action === "extend")
      .map((event) => event.deadline)
      .filter((deadline) => deadline !== undefined),
  );

  for (const customerItem of sources.customerItems) {
    const { handoutInfo, returnInfo } = customerItem;
    if (handoutInfo && !gotBook(customerItem.customer)) {
      const deadlineAtHandout = customerItem.periodExtends?.[0]?.from ?? customerItem.deadline;
      events.push({
        time: new Date(handoutInfo.time).toISOString(),
        action: "handout",
        from: { type: "stand" },
        to: customerParty(customerItem.customer),
        employee: employeeOf(handoutInfo.handoutEmployee),
        byCustomer: false,
        branchName: branchName(handoutInfo.handoutById),
        deadline: new Date(deadlineAtHandout).toISOString(),
        handoutType: customerItem.type,
      });
    }
    if (customerItem.returned && returnInfo && !gaveBook(customerItem.customer)) {
      events.push({
        time: new Date(returnInfo.time).toISOString(),
        action: "return",
        from: customerParty(customerItem.customer),
        to: { type: "stand" },
        employee: employeeOf(returnInfo.returnEmployee),
        byCustomer: false,
        branchName: branchName(returnInfo.returnedToId),
      });
    }
    for (const periodExtend of customerItem.periodExtends ?? []) {
      const deadline = new Date(periodExtend.to).toISOString();
      if (extendDeadlines.has(deadline)) {
        continue;
      }
      events.push({
        time: new Date(periodExtend.time).toISOString(),
        action: "extend",
        to: customerParty(customerItem.customer),
        byCustomer: false,
        previousDeadline: new Date(periodExtend.from).toISOString(),
        deadline,
      });
    }
    // Legacy buyout order items rarely carry the blid, so the order loop misses them; the
    // customer item still knows the book was bought out.
    if (customerItem.buyout) {
      const buyoutOrderId = customerItem.buyoutInfo?.order;
      const buyoutOrder = buyoutOrderId === undefined ? undefined : ordersById.get(buyoutOrderId);
      const time = customerItem.buyoutInfo?.time ?? buyoutOrder?.creationTime;
      const alreadyTold = events.some(
        (event) =>
          (event.action === "buyout" || event.action === "invoice-paid") &&
          (buyoutOrderId === undefined || event.orderId === buyoutOrderId),
      );
      if (!alreadyTold && time !== undefined) {
        events.push({
          time: new Date(time).toISOString(),
          action: "buyout",
          to: customerParty(customerItem.customer),
          employee: employeeOf(buyoutOrder?.employee),
          byCustomer: buyoutOrder?.byCustomer ?? false,
          branchName: branchName(buyoutOrder?.branch),
          orderId: buyoutOrderId,
        });
      }
    }
  }

  // The unique item record itself: when the blid was first linked to a book, and — only the
  // latest, since the record keeps no log — when it was last changed.
  if (sources.registration) {
    const { createdAt, updatedAt } = sources.registration;
    events.push({
      time: new Date(createdAt).toISOString(),
      action: "registered",
      byCustomer: false,
    });
    if (new Date(updatedAt).getTime() - new Date(createdAt).getTime() >= EDIT_TOLERANCE_MS) {
      events.push({
        time: new Date(updatedAt).toISOString(),
        action: "edited",
        byCustomer: false,
      });
    }
  }

  // A held book past its deadline gets a synthetic event, timed at the deadline itself. It
  // vanishes once the book is returned or the deadline extended.
  const heldCustomerItem = sources.customerItems.find(isActivelyHeld);
  if (heldCustomerItem && new Date(heldCustomerItem.deadline) < sources.now) {
    const deadline = new Date(heldCustomerItem.deadline).toISOString();
    events.push({
      time: deadline,
      action: "deadline-expired",
      to: customerParty(heldCustomerItem.customer),
      byCustomer: false,
      deadline,
    });
  }

  // Admin corrections land on the customer item, never on the orders behind it, so the
  // customer item is authoritative for display: its events show its branch (the return its
  // return branch), and its newest deadline-carrying event shows its current deadline.
  for (const customerItem of sources.customerItems) {
    const orderIds = new Set(customerItem.orders);
    const attributed = events.filter(
      (event) => event.orderId !== undefined && orderIds.has(event.orderId),
    );
    const { handoutInfo, returnInfo } = customerItem;
    for (const event of attributed) {
      const branchId =
        event.action === "return" ? returnInfo?.returnedToId : handoutInfo?.handoutById;
      if (branchId !== undefined) {
        event.branchName = branchName(branchId);
      }
    }
    const newestWithDeadline = attributed
      .filter((event) => event.deadline !== undefined)
      .toSorted((a, b) => b.time.localeCompare(a.time))[0];
    if (newestWithDeadline) {
      newestWithDeadline.deadline = new Date(customerItem.deadline).toISOString();
    }
  }

  // The expiry describes the book's current state, so it always tops the list — even when an
  // admin backdates the deadline to before the newest recorded event.
  events.sort((a, b) => {
    if (a.action !== b.action) {
      if (a.action === "deadline-expired") {
        return -1;
      }
      if (b.action === "deadline-expired") {
        return 1;
      }
    }
    return b.time.localeCompare(a.time);
  });

  // Legacy extend records store the moment of extension in info.from, not the deadline being
  // replaced, so the previous deadline is read off the chain: the deadline in effect right
  // before the extend.
  let deadlineInEffect: string | undefined;
  for (const event of events.toReversed()) {
    if (event.action === "extend") {
      event.previousDeadline = deadlineInEffect ?? event.previousDeadline;
    }
    if (event.deadline !== undefined) {
      deadlineInEffect = event.deadline;
    }
  }

  return {
    blid: sources.blid,
    book: sources.item,
    registered: sources.registered,
    status: deriveStatus(sources.customerItems),
    activeItem: deriveActiveItem(sources.customerItems),
    history: events,
  };
}

function deriveActiveItem(customerItems: CustomerItem[]): BlidActiveItem | undefined {
  const active = customerItems.find(isActivelyHeld);
  if (!active) {
    return undefined;
  }
  return {
    customerItemId: active.id,
    deadline: new Date(active.deadline).toISOString(),
    handoutBranchId: active.handoutInfo?.handoutById ?? null,
  };
}

function isActivelyHeld(customerItem: CustomerItem): boolean {
  return Boolean(
    customerItem.handout &&
    !customerItem.returned &&
    !customerItem.buyout &&
    !customerItem.cancel &&
    !customerItem.buyback,
  );
}

/**
 * The customer items are authoritative for where the book is now: a buyout means the customer
 * bought and keeps the book, while returns, buybacks and cancels all leave it back at the stand.
 */
function deriveStatus(customerItems: CustomerItem[]): BlidStatus {
  if (customerItems.some(isActivelyHeld)) {
    return "handed-out";
  }
  const newest = customerItems.toSorted((a, b) => customerItemTime(b) - customerItemTime(a))[0];
  return newest?.buyout && !newest.returned ? "bought-out" : "not-handed-out";
}

function customerItemTime(customerItem: CustomerItem): number {
  const time = customerItem.handoutInfo?.time ?? customerItem.creationTime;
  return time === undefined ? 0 : new Date(time).getTime();
}

async function fetchCustomerItems(blid: string): Promise<CustomerItem[]> {
  const databaseQuery = new SEDbQuery();
  databaseQuery.stringFilters = [{ fieldName: "blid", value: blid }];
  return (await StorageService.CustomerItems.getByQueryOrNull(databaseQuery)) ?? [];
}

async function fetchOrders(blid: string, customerItems: CustomerItem[]): Promise<Order[]> {
  const databaseQuery = new SEDbQuery();
  databaseQuery.stringFilters = [{ fieldName: "orderItems.blid", value: blid }];
  const byBlid = (await StorageService.Orders.getByQueryOrNull(databaseQuery)) ?? [];

  // Legacy order items often lack the blid, but the customer item lists its orders.
  const missingIds = customerItems
    .flatMap((customerItem) => customerItem.orders ?? [])
    .filter((orderId) => !byBlid.some((order) => order.id === orderId));
  const byCustomerItem =
    missingIds.length > 0
      ? await StorageService.Orders.getMany([...new Set(missingIds)], USER_PERMISSION.ADMIN)
      : [];

  return [...byBlid, ...byCustomerItem];
}

/** The ids of the orders whose delivery document is a Bring shipment. */
async function fetchBringDeliveryOrderIds(orders: Order[]): Promise<Set<string>> {
  const deliveryIds = orders.flatMap((order) => (order.delivery ? [order.delivery] : []));
  if (deliveryIds.length === 0) {
    return new Set();
  }
  const deliveries = await StorageService.Deliveries.getMany(deliveryIds, USER_PERMISSION.ADMIN);
  return new Set(
    deliveries.filter((delivery) => delivery.method === "bring").map((delivery) => delivery.order),
  );
}

export const BlidSearchService = {
  /**
   * Corrects the deadline and/or handout branch of an active loan. Any employee may do it; the
   * change is reported to the administrator afterwards unless the employee is an admin.
   */
  async updateActiveItem(
    {
      customerItemId,
      deadline,
      branchId,
    }: {
      customerItemId: string;
      deadline?: string;
      branchId?: string;
    },
    employee: MonitoredEmployee,
  ): Promise<void> {
    const previous = await ActiveItemCorrections.write({
      customerItemId,
      deadline: deadline ? new Date(deadline) : undefined,
      branchId,
    });
    if (!isMonitored(employee)) {
      return;
    }
    const item = await StorageService.Items.getOrNull(previous.item);
    const reported = {
      employee,
      customerId: previous.customer,
      title: item?.title ?? "",
      blid: previous.blid ?? "",
    };
    if (deadline) {
      await ActiveItemMonitoring.reportDeadlineChange({
        ...reported,
        previousDeadline: new Date(previous.deadline),
        deadline: new Date(deadline),
      });
    }
    if (branchId) {
      const previousBranchId = previous.handoutInfo?.handoutById ?? null;
      const [previousBranch, branch] = await Promise.all([
        previousBranchId ? StorageService.Branches.getOrNull(previousBranchId) : null,
        StorageService.Branches.getOrNull(branchId),
      ]);
      await ActiveItemMonitoring.reportBranchChange({
        ...reported,
        previousBranchName: previousBranch?.name ?? null,
        branchName: branch?.name ?? FALLBACK_BRANCH_NAME,
      });
    }
  },

  /**
   * Ranked in the database: by tier, then books a customer currently holds before books at the
   * stand, then by blid. Only the holder names need a second query.
   *
   * @param query Alphanumeric text (the validator guarantees no regex metacharacters).
   */
  async search(query: string): Promise<BlidSearchResponse> {
    const rows = await StorageService.UniqueItems.aggregate<{
      blid: string;
      title: string;
      holder: ObjectId | null;
    }>([
      { $match: { blid: { $regex: query, $options: "i" } } },
      {
        $lookup: {
          from: BlSchemaName.CustomerItems,
          let: { blid: "$blid" },
          pipeline: [
            {
              $match: {
                // The customer items blid index is partial (string blid, not returned, not bought
                // out); the planner only uses it when the filter spells those predicates out, and
                // a localField/foreignField join cannot, so the join is written as an $expr.
                blid: { $type: "string" },
                ...ACTIVE_CUSTOMER_ITEM_MATCH,
                buyback: { $ne: true },
                $expr: { $eq: ["$blid", "$$blid"] },
              },
            },
            { $limit: 1 },
            { $project: { _id: 0, customer: 1 } },
          ],
          as: "activeItems",
        },
      },
      {
        $addFields: {
          tier: blidMatchTierExpression(query),
          held: { $gt: [{ $size: "$activeItems" }, 0] },
        },
      },
      { $sort: { tier: 1, held: -1, blid: 1 } },
      // One past the limit tells whether the list was cut short.
      { $limit: SEARCH_HIT_LIMIT + 1 },
      {
        $project: {
          _id: 0,
          blid: 1,
          title: 1,
          holder: { $ifNull: [{ $first: "$activeItems.customer" }, null] },
        },
      },
    ]);
    const hasMore = rows.length > SEARCH_HIT_LIMIT;
    const winners = rows.slice(0, SEARCH_HIT_LIMIT);
    const holders = new Map(
      winners.flatMap((row) => (row.holder ? [[row.blid, String(row.holder)] as const] : [])),
    );
    const userDetails =
      holders.size === 0
        ? []
        : await StorageService.UserDetails.getMany(
            [...new Set(holders.values())],
            USER_PERMISSION.ADMIN,
          );

    return {
      hits: assembleBlidSearchHits({
        uniqueItems: winners.map(({ blid, title }) => ({ blid, title })),
        holders,
        userDetails: new Map(userDetails.map((detail) => [detail.id, detail.name])),
      }),
      hasMore,
    };
  },

  async lookup(blid: string): Promise<BlidSearchResult> {
    const [uniqueItem, customerItems, handoverModels] = await Promise.all([
      findUniqueItemByBlid(blid),
      fetchCustomerItems(blid),
      BookHandover.query().where("blid", blid).orderBy("occurredAt", "asc"),
    ]);
    const orders = await fetchOrders(blid, customerItems);
    const bringDeliveryOrderIds = await fetchBringDeliveryOrderIds(orders);

    const itemId = uniqueItem?.item ?? customerItems[0]?.item;
    const item = itemId === undefined ? null : await StorageService.Items.getOrNull(itemId);

    const handovers: HandoverRow[] = handoverModels.map((handover) => ({
      fromUserDetailId: handover.fromUserDetailId,
      toUserDetailId: handover.toUserDetailId,
      occurredAt: handover.occurredAt.toJSDate(),
      orderId: handover.orderId,
    }));

    const { userDetailIds, branchIds } = collectReferencedIds(customerItems, orders, handovers);
    const [userDetails, branches] = await Promise.all([
      StorageService.UserDetails.getMany(userDetailIds, USER_PERMISSION.ADMIN),
      StorageService.Branches.getMany(branchIds, USER_PERMISSION.ADMIN),
    ]);

    return assembleBlidSearch({
      blid,
      item:
        item === null
          ? null
          : { id: item.id, title: item.title, isbn: String(item.info?.isbn ?? "") },
      registered: uniqueItem !== null,
      registration:
        uniqueItem?.creationTime && uniqueItem.lastUpdated
          ? { createdAt: uniqueItem.creationTime, updatedAt: uniqueItem.lastUpdated }
          : null,
      customerItems,
      orders,
      handovers,
      bringDeliveryOrderIds,
      userDetails: new Map(userDetails.map((detail) => [detail.id, detail.name])),
      branchNames: new Map(branches.map((branch) => [branch.id, branch.name])),
      now: new Date(),
    });
  },
};
