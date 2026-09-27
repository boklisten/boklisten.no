import { DateTime } from "luxon";

import Branch from "#models/branch";
import BadRequestException from "#exceptions/bad_request_exception";
import BookHandover from "#models/book_handover";
import Delivery from "#models/delivery";
import Order from "#models/order";
import OrderItem from "#models/order_item";
import Payment from "#models/payment";
import User from "#models/user";
import type { MonitoredEmployee } from "#services/employee_monitoring_service";
import { EmployeeMonitoringService } from "#services/employee_monitoring_service";
import { TranslationService } from "#services/translation_service";
import type { Delivery as DeliveryDto } from "#shared/delivery/delivery";
import type { Order as OrderDto, OrderItem as OrderItemDto } from "#shared/order/order";
import { isOpenOrderItem, LOAN_ORDER_ITEM_TYPES } from "#shared/order/open-order-item";
import type {
  OrderHistoryDelivery,
  OrderHistoryEntry,
  OrderHistoryItem,
  OrderHistoryParty,
  OrderHistoryPayment,
  OrderHistoryTransfer,
  OrderPaymentStatus,
} from "#shared/order/order-history";
import type { Payment as PaymentDto } from "#shared/payment/payment";

type OrderHistoryAudience = "customer" | "employee";

/** One row of the book_handovers table, reduced to what pairing needs. */
interface OrderHistoryHandover {
  blid: string | null;
  fromUserDetailId: string | null;
  toUserDetailId: string | null;
  occurredAt: Date;
  orderId: string | null;
}

export interface OrderHistorySources {
  customerId: string;
  audience: OrderHistoryAudience;
  orders: OrderDto[];
  /** The payments of each order, keyed by order id. */
  payments: Map<string, PaymentDto[]>;
  /** The delivery of each order that has one, keyed by order id. */
  deliveries: Map<string, DeliveryDto>;
  /** Every handover the customer took part in, plus those pointing at one of their orders. */
  handovers: OrderHistoryHandover[];
  /**
   * Other customers' match orders for the same copies, for pairing legacy transfers that predate
   * the handover table.
   */
  counterpartOrders: OrderDto[];
  userNames: Map<string, string>;
  branchNames: Map<string, string>;
}

// One physical transfer leaves the sender's order, the receiver's order and (in modern data) the
// handover row within moments of each other; the same window the Boksøk uses.
const TRANSFER_PAIRING_WINDOW_MS = 120_000;

const FALLBACK_NAME = "Ukjent";
const FALLBACK_BRANCH_NAME = "Ukjent filial";

const PERIOD_ITEM_TYPES = new Set<OrderItemDto["type"]>([
  "rent",
  "partly-payment",
  "extend",
  "match-receive",
]);

function iso(date: Date | string | null | undefined): string | null {
  if (date === null || date === undefined) {
    return null;
  }
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

const MATCH_ITEM_TYPES = new Set<OrderItemDto["type"]>(["match-receive", "match-deliver"]);

function withinPairingWindow(a: Date, b: Date): boolean {
  return Math.abs(a.getTime() - b.getTime()) <= TRANSFER_PAIRING_WINDOW_MS;
}

function derivePaymentStatus(order: OrderDto, payments: OrderHistoryPayment[]): OrderPaymentStatus {
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

function presentPayments(order: OrderDto, sources: OrderHistorySources): OrderHistoryPayment[] {
  return (sources.payments.get(order.id) ?? []).map((payment) => ({
    id: payment.id,
    method: payment.method,
    methodLabel: TranslationService.translatePaymentMethod(payment.method),
    amount: payment.amount,
    confirmed: payment.confirmed,
    time: payment.createdAt.toISOString(),
  }));
}

function presentDelivery(
  order: OrderDto,
  sources: OrderHistorySources,
): OrderHistoryDelivery | null {
  const delivery = sources.deliveries.get(order.id);
  if (delivery === undefined) {
    return null;
  }
  if (delivery.method === "branch") {
    return {
      method: "branch",
      branchName:
        delivery.branchId === null ? null : (sources.branchNames.get(delivery.branchId) ?? null),
    };
  }
  return {
    method: "bring",
    trackingNumber: delivery.trackingNumber,
    estimatedDelivery: iso(delivery.estimatedDelivery),
    shipmentAddress:
      delivery.shipmentName !== null &&
      delivery.shipmentAddress !== null &&
      delivery.shipmentPostalCode !== null &&
      delivery.shipmentPostalCity !== null
        ? {
            name: delivery.shipmentName,
            address: delivery.shipmentAddress,
            postalCode: delivery.shipmentPostalCode,
            postalCity: delivery.shipmentPostalCity,
          }
        : null,
    productLabel:
      delivery.product === "3584"
        ? "pakke i postkassen"
        : delivery.product === "SERVICEPAKKE"
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
  order: OrderDto,
  orderItem: OrderItemDto,
  sources: OrderHistorySources,
): OrderHistoryTransfer | null {
  if (orderItem.type !== "match-receive" && orderItem.type !== "match-deliver") {
    return null;
  }
  const direction = orderItem.type === "match-receive" ? "received" : "delivered";
  const orderTime = order.createdAt;

  const handover = sources.handovers.find((candidate) =>
    direction === "received"
      ? candidate.orderId === order.id && candidate.toUserDetailId === sources.customerId
      : candidate.fromUserDetailId === sources.customerId &&
        candidate.blid !== null &&
        candidate.blid === orderItem.blid &&
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
      candidate.customerId !== sources.customerId &&
      withinPairingWindow(candidate.createdAt, orderTime) &&
      candidate.orderItems.some(
        (candidateItem) =>
          candidateItem.type === counterpartType &&
          candidateItem.blid !== null &&
          candidateItem.blid === orderItem.blid,
      ),
  );
  // A counterpart whose account is gone is known to exist but can no longer be named.
  return {
    direction,
    counterparty: counterpart?.customerId ? customerParty(counterpart.customerId, sources) : null,
    time: orderTime.toISOString(),
  };
}

function presentItem(
  order: OrderDto,
  orderItem: OrderItemDto,
  sources: OrderHistorySources,
): OrderHistoryItem {
  const to = iso(orderItem.periodTo);
  return {
    type: orderItem.type,
    typeLabel: TranslationService.translateOrderItemTypePastTense(orderItem.type),
    itemId: orderItem.itemId,
    title: orderItem.title,
    blid: orderItem.blid,
    amount: orderItem.amount,
    unitPrice: orderItem.unitPrice,
    period:
      PERIOD_ITEM_TYPES.has(orderItem.type) && to !== null
        ? { from: iso(orderItem.periodFrom), to, periodType: orderItem.periodType }
        : null,
    amountLeftToPay: orderItem.amountLeftToPay,
    buybackAmount: orderItem.buybackAmount,
    customerItemId: orderItem.customerItemId,
    handout: orderItem.handout,
    delivered: orderItem.delivered,
    movedToOrderId: orderItem.movedToOrderId,
    movedFromOrderId: orderItem.movedFromOrderId,
    transfer: presentTransfer(order, orderItem, sources),
  };
}

function presentOrder(order: OrderDto, sources: OrderHistorySources): OrderHistoryEntry {
  const payments = presentPayments(order, sources);
  // Who registered the order and how the checkout went are staff bookkeeping, not receipt facts.
  const forStaff = sources.audience === "employee";
  return {
    id: order.id,
    creationTime: order.createdAt.toISOString(),
    branch: {
      id: order.branchId,
      name: sources.branchNames.get(order.branchId) ?? FALLBACK_BRANCH_NAME,
    },
    amount: order.amount,
    byCustomer: order.byCustomer,
    employee: forStaff && order.employeeId ? customerParty(order.employeeId, sources) : null,
    emailSuppressed: forStaff && !order.notifyByEmail,
    checkoutState: forStaff ? order.checkoutState : null,
    paymentStatus: derivePaymentStatus(order, payments),
    payments,
    delivery: presentDelivery(order, sources),
    items: order.orderItems.map((orderItem) => presentItem(order, orderItem, sources)),
  };
}

/** Pure: turns fetched orders and documents into the presented history, newest order first. */
export function presentOrderHistory(sources: OrderHistorySources): OrderHistoryEntry[] {
  return sources.orders
    .map((order) => presentOrder(order, sources))
    .toSorted((a, b) => b.creationTime.localeCompare(a.creationTime));
}

/**
 * Other customers' placed match orders for the copies the customer's match orders moved, for
 * pairing legacy transfers.
 */
async function fetchCounterpartOrders(customerId: string, orders: OrderDto[]): Promise<OrderDto[]> {
  const blids = [
    ...new Set(
      orders.flatMap((order) =>
        order.orderItems.flatMap((orderItem) =>
          MATCH_ITEM_TYPES.has(orderItem.type) && orderItem.blid !== null ? [orderItem.blid] : [],
        ),
      ),
    ),
  ];
  if (blids.length === 0) {
    return [];
  }
  const counterparts = await Order.query()
    .where("placed", true)
    .where((query) => {
      void query.whereNull("customerId").orWhereNot("customerId", customerId);
    })
    .whereHas("orderItems", (orderItems) => {
      void orderItems.whereIn("blid", blids).whereIn("type", [...MATCH_ITEM_TYPES]);
    });
  return counterparts.map((order) => order.toDto());
}

async function fetchHandovers(
  customerId: string,
  orders: OrderDto[],
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
  orders: OrderDto[],
): Promise<OrderHistorySources> {
  const [payments, deliveries, handovers, counterpartOrders] = await Promise.all([
    Payment.byOrderIds(orders.map((order) => order.id)),
    Delivery.byOrderIds(orders.map((order) => order.id)),
    fetchHandovers(customerId, orders),
    fetchCounterpartOrders(customerId, orders),
  ]);

  const userDetailIds = new Set<string>();
  const branchIds = new Set<string>();
  for (const order of orders) {
    branchIds.add(order.branchId);
    if (order.employeeId) {
      userDetailIds.add(order.employeeId);
    }
  }
  for (const delivery of deliveries.values()) {
    if (delivery.branchId !== null) {
      branchIds.add(delivery.branchId);
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
    if (order.customerId) {
      userDetailIds.add(order.customerId);
    }
  }

  const [userNames, branchNames] = await Promise.all([
    User.namesByIds(userDetailIds),
    Branch.namesByIds(branchIds),
  ]);

  return {
    customerId,
    audience,
    orders,
    payments: new Map(
      [...payments].map(([orderId, orderPayments]) => [
        orderId,
        orderPayments.map((payment) => payment.toDto()),
      ]),
    ),
    deliveries: new Map([...deliveries].map(([orderId, delivery]) => [orderId, delivery.toDto()])),
    handovers,
    counterpartOrders,
    userNames,
    branchNames,
  };
}

function formatDeadline(deadline: DateTime): string {
  return deadline.toFormat("dd.MM.yyyy");
}

export const OrderHistoryService = {
  /** Every placed order of the customer, newest first. */
  async getForCustomer(
    customerId: string,
    audience: OrderHistoryAudience,
  ): Promise<OrderHistoryEntry[]> {
    const orders = (await Order.placedFor(customerId)).map((order) => order.toDto());
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
    const order = await Order.findOptional(orderId);
    if (!order || order.customerId !== customerId) {
      return null;
    }
    return OrderHistoryService.presentOrder(order, audience);
  },

  /**
   * An order already in hand, presented the same way. An order whose customer is gone is
   * presented from the point of view of nobody in particular.
   */
  async presentOrder(order: Order, audience: OrderHistoryAudience): Promise<OrderHistoryEntry> {
    const [entry] = presentOrderHistory(
      await loadSources(order.customerId ?? "", audience, [order.toDto()]),
    );
    if (entry === undefined) {
      throw new Error(`order ${order.id} could not be presented`);
    }
    return entry;
  },

  /**
   * Move an order to another branch. A deliberate bookkeeping correction: only the order is
   * touched; the customer items it created keep the branch they were handed out from. Any
   * employee may do it, and everyone below admin is reported to the administrator.
   */
  async updateBranch(
    orderId: string,
    branchId: string,
    employee: MonitoredEmployee,
  ): Promise<void> {
    const branch = await Branch.find(branchId);
    if (!branch) {
      throw new BadRequestException("Filialen finnes ikke");
    }
    const order = await Order.findOptional(orderId);
    if (!order) {
      throw new BadRequestException("Ordren finnes ikke");
    }
    const previousBranchId = order.branchId;
    await order.merge({ branchId }).save();
    const previousBranch = await Branch.find(previousBranchId);
    await EmployeeMonitoringService.report({
      action: "order-branch-changed",
      employee,
      customerId: order.customerId,
      details: [
        { label: "Ordre-ID", value: order.id },
        { label: "Gammel filial", value: previousBranch?.name ?? FALLBACK_BRANCH_NAME },
        { label: "Ny filial", value: branch.name },
      ],
    });
  },

  /**
   * Change the deadline of one book the customer has ordered but not yet been handed. Only the
   * order item's period end moves; the handout copies it onto the customer item later. Any
   * employee may do it, and everyone below admin is reported to the administrator.
   */
  async updateItemDeadline(
    {
      orderId,
      itemId,
      deadline,
    }: {
      orderId: string;
      itemId: string;
      deadline: Date;
    },
    employee: MonitoredEmployee,
  ): Promise<void> {
    const order = await Order.findOptional(orderId);
    if (!order) {
      throw new BadRequestException("Ordren finnes ikke");
    }
    const orderItem = order.orderItems.find(
      (candidate) =>
        candidate.itemId === itemId &&
        LOAN_ORDER_ITEM_TYPES.includes(candidate.type) &&
        isOpenOrderItem(candidate),
    );
    if (!orderItem) {
      throw new BadRequestException("Boka er ikke lenger bestilt");
    }
    // The same rule again in the write, so it cannot race a handout.
    const [updated] = await OrderItem.whereOpen(OrderItem.query().where("id", orderItem.id)).update(
      { periodTo: DateTime.fromJSDate(deadline) },
    );
    if (!updated) {
      throw new BadRequestException("Boka er ikke lenger bestilt");
    }
    await order.merge({ updatedAt: DateTime.now() }).save();
    await EmployeeMonitoringService.report({
      action: "order-item-deadline-changed",
      employee,
      customerId: order.customerId,
      details: [
        { label: "Bok", value: `«${orderItem.title}»` },
        { label: "Ordre-ID", value: order.id },
        {
          label: "Gammel frist",
          value: orderItem.periodTo ? formatDeadline(orderItem.periodTo) : "Ingen",
        },
        { label: "Ny frist", value: formatDeadline(DateTime.fromJSDate(deadline)) },
      ],
    });
  },

  /**
   * Delete an order outright. The order goes with its lines, payments and delivery; the customer
   * items and handovers it produced stay as they are. Any employee may do it, and everyone below
   * admin is reported to the administrator.
   */
  async deleteOrder(orderId: string, employee: MonitoredEmployee): Promise<void> {
    const order = await Order.findOptional(orderId);
    if (!order) {
      throw new BadRequestException("Ordren finnes ikke");
    }
    const branch = await Branch.find(order.branchId);
    await order.delete();
    await EmployeeMonitoringService.report({
      action: "order-deleted",
      employee,
      customerId: order.customerId,
      details: [
        { label: "Ordre-ID", value: order.id },
        { label: "Filial", value: branch?.name ?? FALLBACK_BRANCH_NAME },
        { label: "Beløp", value: `${order.amount} kr` },
        {
          label: "Bøker",
          value: order.orderItems.map((orderItem) => `«${orderItem.title}»`).join(", "),
        },
      ],
    });
  },
};
