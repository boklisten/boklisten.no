import { ObjectId } from "mongodb";

import BadRequestException from "#exceptions/bad_request_exception";
import BookHandover from "#models/book_handover";
import { SEDbQuery } from "#services/legacy/query/se.db-query";
import { StorageService } from "#services/storage_service";
import { TranslationService } from "#services/translation_service";
import type { Delivery } from "#shared/delivery/delivery";
import type { DeliveryInfoBranch } from "#shared/delivery/delivery-info/delivery-info-branch";
import type { DeliveryInfoBring } from "#shared/delivery/delivery-info/delivery-info-bring";
import type { Order } from "#shared/order/order";
import type {
  OrderHistoryDelivery,
  OrderHistoryEntry,
  OrderHistoryItem,
  OrderHistoryParty,
  OrderHistoryPayment,
  OrderHistoryTransfer,
  OrderPaymentStatus,
} from "#shared/order/order-history";
import type { OrderItem } from "#shared/order/order-item/order-item";
import type { Payment } from "#shared/payment/payment";
import { USER_PERMISSION } from "#shared/user-permission";

export type OrderHistoryAudience = "customer" | "employee";

/** One row of the book_handovers table, reduced to what pairing needs. */
export interface OrderHistoryHandover {
  blid: string | null;
  fromUserDetailId: string | null;
  toUserDetailId: string | null;
  occurredAt: Date;
  orderId: string | null;
}

export interface OrderHistorySources {
  customerId: string;
  audience: OrderHistoryAudience;
  orders: Order[];
  payments: Map<string, Payment>;
  deliveries: Map<string, Delivery>;
  /** Every handover the customer took part in, plus those pointing at one of their orders. */
  handovers: OrderHistoryHandover[];
  /**
   * Other customers' match orders for the same copies, for pairing legacy transfers that predate
   * the handover table.
   */
  counterpartOrders: Order[];
  userNames: Map<string, string>;
  branchNames: Map<string, string>;
}

// One physical transfer leaves the sender's order, the receiver's order and (in modern data) the
// handover row within moments of each other; the same window the Boksøk uses.
const TRANSFER_PAIRING_WINDOW_MS = 120_000;

const FALLBACK_NAME = "Ukjent";
const FALLBACK_BRANCH_NAME = "Ukjent filial";

const PERIOD_ITEM_TYPES = new Set<OrderItem["type"]>([
  "rent",
  "partly-payment",
  "extend",
  "match-receive",
]);

function isBringInfo(info: Delivery["info"]): info is DeliveryInfoBring {
  return "facilityAddress" in info;
}

function isBranchInfo(info: Delivery["info"]): info is DeliveryInfoBranch {
  return "branch" in info;
}

function iso(date: Date | string | null | undefined): string | null {
  if (date === null || date === undefined) {
    return null;
  }
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function withinPairingWindow(a: Date, b: Date): boolean {
  return Math.abs(a.getTime() - b.getTime()) <= TRANSFER_PAIRING_WINDOW_MS;
}

function derivePaymentStatus(order: Order, payments: OrderHistoryPayment[]): OrderPaymentStatus {
  if (order.orderItems.some((orderItem) => orderItem.type === "invoice-paid")) {
    return "invoice";
  }
  if (order.amount === 0) {
    return "free";
  }
  if (order.amount < 0) {
    return "refunded";
  }
  const covered = payments.reduce((sum, payment) => sum + payment.amount, 0);
  return covered >= order.amount ? "paid" : "unpaid";
}

function presentPayments(order: Order, sources: OrderHistorySources): OrderHistoryPayment[] {
  return order.payments
    .map((paymentId) => sources.payments.get(paymentId))
    .filter((payment): payment is Payment => payment !== undefined)
    .map((payment) => ({
      id: payment.id,
      method: payment.method,
      methodLabel: TranslationService.translatePaymentMethod(payment.method),
      amount: payment.amount,
      confirmed: payment.confirmed,
      branchName: sources.branchNames.get(payment.branch) ?? null,
      time: iso(payment.creationTime),
    }));
}

function presentDelivery(order: Order, sources: OrderHistorySources): OrderHistoryDelivery | null {
  const delivery = order.delivery ? sources.deliveries.get(order.delivery) : undefined;
  if (delivery === undefined) {
    return order.handoutByDelivery ? { method: "missing" } : null;
  }
  if (delivery.method === "branch") {
    const branchId = isBranchInfo(delivery.info) ? delivery.info.branch : null;
    return {
      method: "branch",
      branchName: branchId === null ? null : (sources.branchNames.get(branchId) ?? null),
    };
  }
  const info = isBringInfo(delivery.info) ? delivery.info : null;
  if (info === null) {
    return { method: "missing" };
  }
  return {
    method: "bring",
    trackingNumber: info.trackingNumber ?? null,
    estimatedDelivery: iso(info.estimatedDelivery),
    shipmentAddress: info.shipmentAddress
      ? {
          name: info.shipmentAddress.name,
          address: info.shipmentAddress.address,
          postalCode: info.shipmentAddress.postalCode,
          postalCity: info.shipmentAddress.postalCity,
        }
      : null,
    productLabel:
      info.product === "3584"
        ? "pakke i postkassen"
        : info.product === "SERVICEPAKKE"
          ? "pakke til hentested"
          : null,
    amount: delivery.amount,
  };
}

function customerParty(detailsId: string, sources: OrderHistorySources): OrderHistoryParty {
  return { detailsId, name: sources.userNames.get(detailsId) ?? FALLBACK_NAME };
}

/**
 * The other student in a match transfer. Handover rows are authoritative: a receive order is
 * named by the row pointing at it, a deliver order by the row the sender's scan produced for the
 * same copy in the same moment. Legacy pairs predate the rows, so they fall back to the
 * counterpart's opposite-typed order for the same copy within the pairing window.
 */
function presentTransfer(
  order: Order,
  orderItem: OrderItem,
  sources: OrderHistorySources,
): OrderHistoryTransfer | null {
  if (orderItem.type !== "match-receive" && orderItem.type !== "match-deliver") {
    return null;
  }
  const direction = orderItem.type === "match-receive" ? "received" : "delivered";
  const orderTime = order.creationTime ? new Date(order.creationTime) : null;

  const handover = sources.handovers.find((candidate) =>
    direction === "received"
      ? candidate.orderId === order.id && candidate.toUserDetailId === sources.customerId
      : candidate.fromUserDetailId === sources.customerId &&
        candidate.blid !== null &&
        candidate.blid === orderItem.blid &&
        orderTime !== null &&
        withinPairingWindow(candidate.occurredAt, orderTime),
  );
  if (handover) {
    const counterpartId =
      direction === "received" ? handover.fromUserDetailId : handover.toUserDetailId;
    return {
      direction,
      counterparty: counterpartId === null ? null : customerParty(counterpartId, sources),
      time: handover.occurredAt.toISOString(),
    };
  }

  const counterpartType = direction === "received" ? "match-deliver" : "match-receive";
  const counterpart = sources.counterpartOrders.find(
    (candidate) =>
      candidate.customer !== sources.customerId &&
      candidate.creationTime !== undefined &&
      orderTime !== null &&
      withinPairingWindow(new Date(candidate.creationTime), orderTime) &&
      candidate.orderItems.some(
        (candidateItem) =>
          candidateItem.type === counterpartType &&
          candidateItem.blid !== undefined &&
          candidateItem.blid === orderItem.blid,
      ),
  );
  return {
    direction,
    counterparty: counterpart ? customerParty(counterpart.customer, sources) : null,
    time: orderTime?.toISOString() ?? "",
  };
}

function presentItem(
  order: Order,
  orderItem: OrderItem,
  sources: OrderHistorySources,
): OrderHistoryItem {
  const info = orderItem.info;
  const to = iso(info?.to);
  return {
    type: orderItem.type,
    typeLabel: TranslationService.translateOrderItemTypePastTense(orderItem.type),
    itemId: orderItem.item,
    title: orderItem.title,
    blid: orderItem.blid ?? null,
    amount: orderItem.amount,
    unitPrice: orderItem.unitPrice,
    period:
      PERIOD_ITEM_TYPES.has(orderItem.type) && to !== null
        ? { from: iso(info?.from), to, periodType: info?.periodType ?? null }
        : null,
    amountLeftToPay: info?.amountLeftToPay ?? null,
    buybackAmount: info?.buybackAmount ?? null,
    customerItemId: orderItem.customerItem ?? info?.customerItem ?? null,
    handout: orderItem.handout,
    delivered: orderItem.delivered,
    movedToOrderId: orderItem.movedToOrder ?? null,
    movedFromOrderId: orderItem.movedFromOrder ?? null,
    transfer: presentTransfer(order, orderItem, sources),
  };
}

function presentOrder(order: Order, sources: OrderHistorySources): OrderHistoryEntry {
  const payments = presentPayments(order, sources);
  // Who registered the order and how the checkout went are staff bookkeeping, not receipt facts.
  const forStaff = sources.audience === "employee";
  return {
    id: order.id,
    creationTime: iso(order.creationTime) ?? "",
    branch: {
      id: order.branch,
      name: sources.branchNames.get(order.branch) ?? FALLBACK_BRANCH_NAME,
    },
    amount: order.amount,
    byCustomer: order.byCustomer,
    employee: forStaff && order.employee ? customerParty(order.employee, sources) : null,
    emailSuppressed: forStaff && order.notification?.email === false,
    checkoutState: forStaff ? (order.checkoutState ?? null) : null,
    handoutByDelivery: order.handoutByDelivery,
    paymentStatus: derivePaymentStatus(order, payments),
    payments,
    delivery: presentDelivery(order, sources),
    items: order.orderItems.map((orderItem) => presentItem(order, orderItem, sources)),
  };
}

/** Pure: turns fetched documents into the presented history, newest order first. */
export function presentOrderHistory(sources: OrderHistorySources): OrderHistoryEntry[] {
  return sources.orders
    .map((order) => presentOrder(order, sources))
    .toSorted((a, b) => b.creationTime.localeCompare(a.creationTime));
}

function isMatchItem(orderItem: OrderItem): boolean {
  return orderItem.type === "match-receive" || orderItem.type === "match-deliver";
}

async function fetchCounterpartOrders(customerId: string, orders: Order[]): Promise<Order[]> {
  const blids = new Set(
    orders.flatMap((order) =>
      order.orderItems.flatMap((orderItem) =>
        isMatchItem(orderItem) && orderItem.blid !== undefined ? [orderItem.blid] : [],
      ),
    ),
  );
  const perBlid = await Promise.all(
    [...blids].map(async (blid) => {
      const databaseQuery = new SEDbQuery();
      databaseQuery.stringFilters = [{ fieldName: "orderItems.blid", value: blid }];
      return (await StorageService.Orders.getByQueryOrNull(databaseQuery)) ?? [];
    }),
  );
  return perBlid
    .flat()
    .filter(
      (order) =>
        order.customer !== customerId && order.placed && order.orderItems.some(isMatchItem),
    );
}

async function fetchHandovers(
  customerId: string,
  orders: Order[],
): Promise<OrderHistoryHandover[]> {
  const rows = await BookHandover.query()
    .where("fromUserDetailId", customerId)
    .orWhere("toUserDetailId", customerId)
    .orWhereIn(
      "orderId",
      orders.map((order) => order.id),
    );
  return rows.map((row) => ({
    blid: row.blid,
    fromUserDetailId: row.fromUserDetailId,
    toUserDetailId: row.toUserDetailId,
    occurredAt: row.occurredAt.toJSDate(),
    orderId: row.orderId,
  }));
}

async function loadSources(
  customerId: string,
  audience: OrderHistoryAudience,
  orders: Order[],
): Promise<OrderHistorySources> {
  const paymentIds = [...new Set(orders.flatMap((order) => order.payments))];
  const deliveryIds = [
    ...new Set(
      orders
        .map((order) => order.delivery)
        .filter((id): id is string => typeof id === "string" && id !== ""),
    ),
  ];

  const [payments, deliveries, handovers, counterpartOrders] = await Promise.all([
    paymentIds.length > 0 ? StorageService.Payments.getMany(paymentIds, USER_PERMISSION.ADMIN) : [],
    deliveryIds.length > 0
      ? StorageService.Deliveries.getMany(deliveryIds, USER_PERMISSION.ADMIN)
      : [],
    fetchHandovers(customerId, orders),
    fetchCounterpartOrders(customerId, orders),
  ]);

  const userDetailIds = new Set<string>();
  const branchIds = new Set<string>();
  for (const order of orders) {
    branchIds.add(order.branch);
    if (order.employee) {
      userDetailIds.add(order.employee);
    }
  }
  for (const payment of payments) {
    branchIds.add(payment.branch);
  }
  for (const delivery of deliveries) {
    if (delivery.method === "branch" && isBranchInfo(delivery.info)) {
      branchIds.add(delivery.info.branch);
    }
  }
  for (const handover of handovers) {
    if (handover.fromUserDetailId) {
      userDetailIds.add(handover.fromUserDetailId);
    }
    if (handover.toUserDetailId) {
      userDetailIds.add(handover.toUserDetailId);
    }
  }
  for (const order of counterpartOrders) {
    userDetailIds.add(order.customer);
  }

  const [userDetails, branches] = await Promise.all([
    userDetailIds.size > 0
      ? StorageService.UserDetails.getMany([...userDetailIds], USER_PERMISSION.ADMIN)
      : [],
    branchIds.size > 0
      ? StorageService.Branches.getMany([...branchIds], USER_PERMISSION.ADMIN)
      : [],
  ]);

  return {
    customerId,
    audience,
    orders,
    payments: new Map(payments.map((payment) => [payment.id, payment])),
    deliveries: new Map(deliveries.map((delivery) => [delivery.id, delivery])),
    handovers,
    counterpartOrders,
    userNames: new Map(userDetails.map((detail) => [detail.id, detail.name])),
    branchNames: new Map(branches.map((branch) => [branch.id, branch.name])),
  };
}

async function fetchPlacedOrders(customerId: string): Promise<Order[]> {
  const databaseQuery = new SEDbQuery();
  databaseQuery.objectIdFilters = [{ fieldName: "customer", value: customerId }];
  databaseQuery.booleanFilters = [{ fieldName: "placed", value: true }];
  databaseQuery.sortFilters = [{ fieldName: "creationTime", direction: -1 }];
  return (await StorageService.Orders.getByQueryOrNull(databaseQuery)) ?? [];
}

export const OrderHistoryService = {
  /** Every placed order of the customer, newest first. */
  async getForCustomer(
    customerId: string,
    audience: OrderHistoryAudience,
  ): Promise<OrderHistoryEntry[]> {
    const orders = await fetchPlacedOrders(customerId);
    if (orders.length === 0) {
      return [];
    }
    return presentOrderHistory(await loadSources(customerId, audience, orders));
  },

  /** One order, presented the same way; null when it does not exist or belongs to someone else. */
  async getOne(
    orderId: string,
    customerId: string,
    audience: OrderHistoryAudience,
  ): Promise<OrderHistoryEntry | null> {
    const order = await StorageService.Orders.getOrNull(orderId);
    if (!order || order.customer !== customerId) {
      return null;
    }
    const [entry] = presentOrderHistory(await loadSources(customerId, audience, [order]));
    return entry ?? null;
  },

  /**
   * Move an order to another branch. A deliberate bookkeeping correction: only the order is
   * touched; the customer items it created keep the branch they were handed out from.
   */
  async updateBranch(orderId: string, branchId: string): Promise<void> {
    const branch = await StorageService.Branches.getOrNull(branchId);
    if (!branch) {
      throw new BadRequestException("Filialen finnes ikke");
    }
    const order = await StorageService.Orders.getOrNull(orderId);
    if (!order) {
      throw new BadRequestException("Ordren finnes ikke");
    }
    await StorageService.Orders.update(orderId, { branch: new ObjectId(branchId) });
  },
};
