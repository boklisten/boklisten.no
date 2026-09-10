import { SEDbQuery } from "#models/mongoose/storage/db-query";
import { periodTypeOfLastOrder } from "#services/customer_item_actions_service";
import { findUniqueItemByBlid } from "#services/item_lookup";
import { itemIdsInActiveUserMatches } from "#services/matches/cancellation_block";
import { PeerObligations } from "#services/matches/peer_obligations";
import {
  alreadyPaidFor,
  priceCustomerItemLine,
  priceItemLine,
  priceOrderLine,
} from "#services/stand_cart/stand_cart_pricing";
import { StorageService } from "#services/storage_service";
import type { Branch } from "#shared/branch";
import type { BranchItem } from "#shared/branch-item";
import type { CustomerItem } from "#shared/customer-item/customer-item";
import type { Item } from "#shared/item";
import { itemsAreEquivalent } from "#shared/item-equivalence";
import { isOpenOrderItem } from "#shared/order/open-order-item";
import type { Order } from "#shared/order/order";
import type { OrderItem } from "#shared/order/order-item/order-item";
import { lineKey, unlinkedBlidMessage } from "#shared/stand_cart";
import type {
  StandCartLine,
  StandCartLookup,
  StandCartNote,
  StandCartResolveResult,
  StandCartSource,
} from "#shared/stand_cart";

export interface StandCartResolveRequest {
  customerId: string;
  /** The cart branch: handouts are priced from it and recorded on it. */
  branchId: string;
  source: StandCartLookup;
  /** A scanned copy to attach to an order line. */
  blid?: string | undefined;
  /** Keys already in the cart; a scanned blid never joins a line the cart already has. */
  takenKeys?: string[] | undefined;
}

/** The documents behind a line, for the checkout that turns choices into order items. */
export type StandCartLineContext =
  | { kind: "order"; order: Order; orderItem: OrderItem; item: Item }
  | { kind: "customerItem"; customerItem: CustomerItem; item: Item; handoutBranch: Branch | null }
  | { kind: "item"; item: Item };

export type StandCartResolution =
  | Exclude<StandCartResolveResult, { kind: "line" }>
  | { kind: "line"; line: StandCartLine; context: StandCartLineContext };

const HELD_BY_OTHER_CUSTOMER_MESSAGE =
  "Denne boka er allerede delt ut til en annen kunde. Sjekk boka i Boksøk.";

type Refused = Extract<StandCartResolveResult, { kind: "refused" }>;

function refused(message: string): Refused {
  return { kind: "refused", message };
}

function isActiveCustomerItem(customerItem: CustomerItem): boolean {
  return (
    customerItem.handout &&
    !customerItem.returned &&
    !customerItem.buyout &&
    !customerItem.cancel &&
    !customerItem.buyback
  );
}

async function findBranchItem(branchId: string, itemId: string): Promise<BranchItem | null> {
  const query = new SEDbQuery();
  query.objectIdFilters = [
    { fieldName: "branch", value: branchId },
    { fieldName: "item", value: itemId },
  ];
  const [branchItem] = (await StorageService.BranchItems.getByQueryOrNull(query)) ?? [];
  return branchItem ?? null;
}

/** The customer item, if any, of whoever currently holds the copy. */
async function findHolder(blid: string): Promise<CustomerItem | null> {
  const query = new SEDbQuery();
  query.stringFilters = [{ fieldName: "blid", value: blid }];
  const customerItems = (await StorageService.CustomerItems.getByQueryOrNull(query)) ?? [];
  return customerItems.find((customerItem) => isActiveCustomerItem(customerItem)) ?? null;
}

async function placedOrdersOf(customerId: string): Promise<Order[]> {
  const query = new SEDbQuery();
  query.objectIdFilters = [{ fieldName: "customer", value: customerId }];
  query.booleanFilters = [{ fieldName: "placed", value: true }];
  return (await StorageService.Orders.getByQueryOrNull(query)) ?? [];
}

async function peerMatchNote(customerId: string, itemId: string): Promise<StandCartNote | null> {
  const senderId = await PeerObligations.findPeerSender(customerId, itemId);
  if (senderId === null) {
    return null;
  }
  const sender = await StorageService.UserDetails.getOrNull(senderId);
  return { kind: "peer-match", deliverFromName: sender?.name ?? "en annen elev" };
}

async function isBringDelivery(order: Order): Promise<boolean> {
  if (!order.delivery) {
    return false;
  }
  const delivery = await StorageService.Deliveries.getOrNull(order.delivery);
  return delivery?.method === "bring";
}

/**
 * The order the customer paid to get the book, and its line for the book. The handout order
 * carries the copy at 0 kr and points back to the order the customer actually paid, so the
 * refund follows that link. Null when the book was never paid for through an order.
 */
export async function findPaidOrderForCustomerItem(
  customerItem: CustomerItem,
): Promise<{ order: Order; orderItem: OrderItem } | null> {
  const handoutOrder = await StorageService.Orders.getOrNull(customerItem.orders[0]);
  const handoutItem = handoutOrder?.orderItems.find(
    (orderItem) =>
      orderItem.customerItem === customerItem.id ||
      (orderItem.customerItem === undefined && orderItem.item === customerItem.item),
  );
  if (!handoutOrder || !handoutItem) {
    return null;
  }
  if (!handoutItem.movedFromOrder) {
    return { order: handoutOrder, orderItem: handoutItem };
  }
  const original = await StorageService.Orders.getOrNull(handoutItem.movedFromOrder);
  const originalItem = original?.orderItems.find((orderItem) =>
    itemsAreEquivalent(orderItem.item, customerItem.item),
  );
  return original && originalItem ? { order: original, orderItem: originalItem } : null;
}

/** What the customer paid to get the book. */
async function paidForCustomerItem(customerItem: CustomerItem): Promise<number> {
  const paid = await findPaidOrderForCustomerItem(customerItem);
  return paid ? alreadyPaidFor(paid.order, paid.orderItem) : 0;
}

type Unlinked = Extract<StandCartResolveResult, { kind: "unlinked" }>;

/** The book behind a blid, refused when the copy is unlinked or in someone else's hands. */
async function loadFreeCopy(blid: string, customerId: string): Promise<Item | Refused | Unlinked> {
  const uniqueItem = await findUniqueItemByBlid(blid);
  if (uniqueItem === null) {
    return { kind: "unlinked", blid };
  }
  const holder = await findHolder(blid);
  if (holder !== null && holder.customer !== customerId) {
    return refused(HELD_BY_OTHER_CUSTOMER_MESSAGE);
  }
  const item = await StorageService.Items.getOrNull(uniqueItem.item);
  return item ?? refused(`Fant ikke boka som unik ID ${blid} er koblet til`);
}

async function resolveOrderLine(
  { customerId, branchId, blid }: StandCartResolveRequest,
  source: Extract<StandCartSource, { kind: "order" }>,
  branch: Branch,
  now: Date,
): Promise<StandCartResolution> {
  const order = await StorageService.Orders.getOrNull(source.orderId);
  if (!order || order.customer !== customerId) {
    return refused("Fant ikke bestillingen");
  }
  const orderedItem = await StorageService.Items.getOrNull(source.itemId);
  if (!orderedItem) {
    return refused("Fant ikke boka");
  }
  const orderItem = order.orderItems.find(
    (candidate) => candidate.item === source.itemId && isOpenOrderItem(candidate),
  );
  if (!orderItem) {
    return refused(`«${orderedItem.title}» er ikke lenger bestilt`);
  }

  // The scanned copy may be an equivalent edition; the line then records the edition in hand.
  let item = orderedItem;
  if (blid !== undefined) {
    const copy = await loadFreeCopy(blid, customerId);
    if ("kind" in copy) {
      return copy.kind === "unlinked" ? refused(unlinkedBlidMessage(blid)) : copy;
    }
    if (!itemsAreEquivalent(copy.id, source.itemId)) {
      return refused(`Unik ID ${blid} er «${copy.title}», ikke «${orderedItem.title}»`);
    }
    item = copy;
  }

  const [branchItem, blockedItemIds, peerNote, orderBranch, bringDelivery] = await Promise.all([
    findBranchItem(branchId, item.id),
    itemIdsInActiveUserMatches(customerId),
    peerMatchNote(customerId, item.id),
    StorageService.Branches.getOrNull(order.branch),
    isBringDelivery(order),
  ]);
  const priced = priceOrderLine({
    branch,
    item,
    branchItem,
    originalOrder: order,
    originalOrderItem: orderItem,
    blockedByMatch: blockedItemIds.has(source.itemId),
    scanned: blid !== undefined,
    now,
  });
  const alreadyPaid = alreadyPaidFor(order, orderItem);
  const notes: StandCartNote[] = [];
  if (peerNote) {
    notes.push(peerNote);
  }
  if (order.branch !== branchId && orderBranch) {
    notes.push({ kind: "other-branch", branchName: orderBranch.name });
  }
  if (alreadyPaid > 0) {
    notes.push({ kind: "prepaid", amount: alreadyPaid });
  }
  if (bringDelivery) {
    notes.push({ kind: "bring-delivery" });
  }
  return {
    kind: "line",
    line: {
      key: lineKey(source),
      source,
      itemId: item.id,
      title: item.title,
      blid: blid ?? null,
      ...priced,
      originalBranch: orderBranch ? { id: orderBranch.id, name: orderBranch.name } : null,
      notes,
    },
    context: { kind: "order", order, orderItem, item },
  };
}

async function resolveCustomerItemLine(
  { customerId }: StandCartResolveRequest,
  source: Extract<StandCartSource, { kind: "customerItem" }>,
  branch: Branch,
  now: Date,
): Promise<StandCartResolution> {
  const customerItem = await StorageService.CustomerItems.getOrNull(source.customerItemId);
  if (!customerItem || customerItem.customer !== customerId) {
    return refused("Fant ikke boka");
  }
  const item = await StorageService.Items.getOrNull(customerItem.item);
  if (!item) {
    return refused("Fant ikke boka");
  }
  if (!isActiveCustomerItem(customerItem)) {
    return refused(`Kunden har ikke «${item.title}» lenger`);
  }
  const [handoutBranch, paidAmount, periodType] = await Promise.all([
    StorageService.Branches.getOrNull(customerItem.handoutInfo?.handoutById),
    paidForCustomerItem(customerItem),
    periodTypeOfLastOrder(customerItem),
  ]);
  const priced = priceCustomerItemLine({
    branch,
    handoutBranch,
    item,
    customerItem,
    paidAmount,
    periodType,
    now,
  });
  return {
    kind: "line",
    line: {
      key: lineKey(source),
      source,
      itemId: item.id,
      title: item.title,
      blid: customerItem.blid ?? null,
      ...priced,
      originalBranch: handoutBranch ? { id: handoutBranch.id, name: handoutBranch.name } : null,
      notes: [],
    },
    context: { kind: "customerItem", customerItem, item, handoutBranch },
  };
}

async function resolveItemLine(
  { customerId, branchId }: StandCartResolveRequest,
  source: Extract<StandCartSource, { kind: "item" }>,
  branch: Branch,
  now: Date,
): Promise<StandCartResolution> {
  const item = await loadFreeCopy(source.blid, customerId);
  if ("kind" in item) {
    return item.kind === "unlinked" ? refused(unlinkedBlidMessage(source.blid)) : item;
  }
  if (item.id !== source.itemId) {
    return refused(`Unik ID ${source.blid} er «${item.title}»`);
  }
  const [branchItem, peerNote] = await Promise.all([
    findBranchItem(branchId, item.id),
    peerMatchNote(customerId, item.id),
  ]);
  return {
    kind: "line",
    line: {
      key: lineKey(source),
      source,
      itemId: item.id,
      title: item.title,
      blid: source.blid,
      ...priceItemLine({ branch, item, branchItem, now }),
      originalBranch: null,
      notes: peerNote ? [peerNote] : [],
    },
    context: { kind: "item", item },
  };
}

/**
 * Where a scanned copy belongs: the customer's own active book, an open order for that title,
 * or a copy nobody ordered. Order lines the cart already holds are skipped so a second copy of
 * the same title becomes its own line.
 */
async function resolveBlid(
  request: StandCartResolveRequest,
  blid: string,
  branch: Branch,
  now: Date,
): Promise<StandCartResolution> {
  const copy = await loadFreeCopy(blid, request.customerId);
  if ("kind" in copy) {
    return copy;
  }
  const held = await findHolder(blid);
  if (held !== null) {
    return resolveCustomerItemLine(
      request,
      { kind: "customerItem", customerItemId: held.id },
      branch,
      now,
    );
  }
  const taken = new Set(request.takenKeys);
  for (const order of await placedOrdersOf(request.customerId)) {
    for (const orderItem of order.orderItems) {
      if (!isOpenOrderItem(orderItem) || !itemsAreEquivalent(orderItem.item, copy.id)) {
        continue;
      }
      const source = { kind: "order", orderId: order.id, itemId: orderItem.item } as const;
      if (!taken.has(lineKey(source))) {
        return resolveOrderLine({ ...request, blid }, source, branch, now);
      }
    }
  }
  return resolveItemLine(request, { kind: "item", itemId: copy.id, blid }, branch, now);
}

export const StandCartLineResolver = {
  /** Loads what a source points at and prices it for the cart branch, or says why it cannot. */
  async resolve(
    request: StandCartResolveRequest,
    now = new Date(),
  ): Promise<StandCartResolveResult> {
    const resolution = await StandCartLineResolver.resolveWithContext(request, now);
    return resolution.kind === "line" ? { kind: "line", line: resolution.line } : resolution;
  },

  /** As `resolve`, keeping the loaded documents for the checkout. */
  async resolveWithContext(
    request: StandCartResolveRequest,
    now = new Date(),
  ): Promise<StandCartResolution> {
    const branch = await StorageService.Branches.getOrNull(request.branchId);
    if (!branch) {
      return refused("Fant ikke filialen");
    }
    const { source } = request;
    switch (source.kind) {
      case "order": {
        return resolveOrderLine(request, source, branch, now);
      }
      case "customerItem": {
        return resolveCustomerItemLine(request, source, branch, now);
      }
      case "item": {
        return resolveItemLine(request, source, branch, now);
      }
      case "blid": {
        return resolveBlid(request, source.blid, branch, now);
      }
      default: {
        throw new Error(`unknown lookup ${JSON.stringify(source)}`);
      }
    }
  },
};
