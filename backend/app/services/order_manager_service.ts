import db from "@adonisjs/lucid/services/db";
import type { ChainableContract } from "@adonisjs/lucid/types/querybuilder";

import BadRequestException from "#exceptions/bad_request_exception";
import Branch from "#models/branch";
import { isObjectIdHex } from "#models/helpers/object_id";
import Order from "#models/order";
import OrderItem from "#models/order_item";
import User from "#models/user";
import { OrderHistoryService } from "#services/order_history_service";
import { OrderPayments } from "#services/payments/order_payments";
import { withBranchName, withUserColumns } from "#services/report_columns";
import { StorageService } from "#services/storage_service";
import type { DeliveryInfoBring } from "#shared/delivery/delivery-info/delivery-info-bring";
import type {
  BringParcelType,
  BringReportRow,
  OrderManagerDetail,
  OrderManagerFilter,
  OrderManagerPage,
  OrderManagerReportRow,
  OrderManagerRow,
} from "#shared/order_manager";
import { ORDER_MANAGER_PAGE_SIZE } from "#shared/order_manager";
import { isOpenOrderItem } from "#shared/order/open-order-item";
import { USER_PERMISSION } from "#shared/user-permission";

/** Mailbox parcels carry Bring product 3584; every other product (and none) goes to a pickup point. */
const MAILBOX_PRODUCT = "3584";

/**
 * Placed orders with a book still owed, on the wanted branches. Written against `orders` so it
 * serves both the model query of the list and the joined queries of the exports.
 */
function whereOpenOrder<Query extends ChainableContract>(
  query: Query,
  filter: OrderManagerFilter,
): Query {
  void query.where("orders.placed", true).whereExists((lines) => {
    void OrderItem.whereOpen(
      lines.from("order_items").whereColumn("order_items.order_id", "orders.id"),
    );
  });
  if (filter.branchIds && filter.branchIds.length > 0) {
    void query.whereIn("orders.branch_id", filter.branchIds);
  }
  return query;
}

/**
 * The Bring deliveries among the given ids, keyed by id. Deliveries stay in Mongo until step 10,
 * so the delivery ids come from Postgres and the method from Mongo.
 */
async function bringDeliveries(
  deliveryIds: Iterable<string | null>,
): Promise<Map<string, DeliveryInfoBring>> {
  const ids = [...new Set([...deliveryIds].filter((id): id is string => id !== null))];
  if (ids.length === 0) {
    return new Map();
  }
  const deliveries = await StorageService.Deliveries.getMany(ids, USER_PERMISSION.ADMIN);
  return new Map(
    deliveries.flatMap((delivery) =>
      delivery.method === "bring" && "facilityAddress" in delivery.info
        ? [[delivery.id, delivery.info] as const]
        : [],
    ),
  );
}

/**
 * The Bring deliveries of every open order the filter matches. The candidates are few (only
 * orders with a book still owed and a delivery at all), so the Bring filter can narrow the SQL by
 * delivery id and paging stays exact.
 */
async function bringDeliveriesOfOpenOrders(
  filter: OrderManagerFilter,
): Promise<Map<string, DeliveryInfoBring>> {
  const rows: { deliveryId: string }[] = await whereOpenOrder(db.from("orders"), filter)
    .whereNotNull("orders.delivery_id")
    .distinct("orders.delivery_id as deliveryId");
  return bringDeliveries(rows.map((row) => row.deliveryId));
}

/** Only the orders whose delivery is one of the given Bring deliveries. */
function whereDeliveredBy<Query extends ChainableContract>(
  query: Query,
  deliveries: Map<string, DeliveryInfoBring>,
): Query {
  return query.whereIn("orders.delivery_id", [...deliveries.keys()]);
}

/**
 * Paid by the rule the stand has always used: nothing to pay, or any payment recorded. Returns
 * the ids of the orders that are paid.
 */
async function paidOrderIds(orders: { id: string; amount: number }[]): Promise<Set<string>> {
  const owing = orders.filter((order) => order.amount > 0);
  const payments = await OrderPayments.byOrder(owing.map((order) => order.id));
  return new Set(
    orders.filter((order) => order.amount <= 0 || payments.has(order.id)).map((order) => order.id),
  );
}

async function presentRows(orders: Order[], bring: Set<string>): Promise<OrderManagerRow[]> {
  const [branchNames, customerNames, paid] = await Promise.all([
    Branch.namesByIds(orders.map((order) => order.branchId)),
    User.namesByIds(orders.map((order) => order.customerId)),
    paidOrderIds(orders),
  ]);
  return orders.map((order) => ({
    id: order.id,
    creationTime: order.createdAt.toJSDate().toISOString(),
    customer:
      order.customerId === null
        ? null
        : { id: order.customerId, name: customerNames.get(order.customerId) ?? "Ukjent kunde" },
    branch: { id: order.branchId, name: branchNames.get(order.branchId) ?? null },
    openItems: order.orderItems.filter(isOpenOrderItem).map((orderItem) => ({
      itemId: orderItem.itemId,
      title: orderItem.title,
      type: orderItem.type,
    })),
    bring: bring.has(order.id),
    unpaid: !paid.has(order.id),
  }));
}

interface Cursor {
  createdAt: Date;
  id: string;
}

const CURSOR_SEPARATOR = "_";

function encodeCursor(row: OrderManagerRow): string {
  return `${row.creationTime}${CURSOR_SEPARATOR}${row.id}`;
}

function decodeCursor(cursor: string): Cursor {
  const separator = cursor.lastIndexOf(CURSOR_SEPARATOR);
  const createdAt = new Date(cursor.slice(0, separator));
  const id = cursor.slice(separator + 1);
  if (separator === -1 || Number.isNaN(createdAt.getTime()) || !isObjectIdHex(id)) {
    throw new BadRequestException("Ugyldig posisjon i listen");
  }
  return { createdAt, id };
}

/**
 * One page of open orders newest first, strictly older than the cursor, walking
 * `(created_at, id)`; one row more than the page, to know whether there is a next page.
 */
export async function findOpenOrdersPage(
  filter: OrderManagerFilter,
  limit: number,
  cursor?: Cursor,
): Promise<{ orders: Order[]; bring: Set<string> }> {
  const query = whereOpenOrder(Order.query(), filter);
  const bringOnly = filter.bringOnly ? await bringDeliveriesOfOpenOrders(filter) : null;
  if (bringOnly) {
    void whereDeliveredBy(query, bringOnly);
  }
  if (cursor) {
    void query.whereRaw("(orders.created_at, orders.id) < (?, ?)", [cursor.createdAt, cursor.id]);
  }
  const orders = await query
    .orderBy("createdAt", "desc")
    .orderBy("id", "desc")
    .limit(limit + 1);
  const deliveries = bringOnly ?? (await bringDeliveries(orders.map((order) => order.deliveryId)));
  return {
    orders,
    bring: new Set(
      orders
        .filter((order) => order.deliveryId !== null && deliveries.has(order.deliveryId))
        .map((order) => order.id),
    ),
  };
}

/** The customer columns of the orders report, in the order the CSV lists them. */
export function customerReportColumns(user: User | undefined) {
  return {
    name: user?.name ?? null,
    email: user?.email ?? null,
    phone: user?.phone ?? null,
    address: user?.address ?? null,
    dob: user?.dob?.toFormat("dd.MM.yyyy") ?? null,
    branchMembershipId: user?.branchMembershipId ?? null,
  };
}

/** What the Bring rows are built from; the Mybring headers differ per parcel type. */
interface BringShipment {
  name: string | null;
  address: string | null;
  postalCode: string | null;
  phone: string | null;
  email: string | null;
}

/** Norwegian numbers are stored without the country code; Mybring wants it. */
function internationalPhone(phone: string | null): string {
  if (phone === null) {
    return "";
  }
  return phone.startsWith("+") ? phone : `+47${phone}`;
}

/** The exact column headers of Mybring's bulk-import templates, as the legacy export wrote them. */
export function toBringReportRow(
  shipment: BringShipment,
  parcelType: BringParcelType,
): BringReportRow {
  const shared = {
    "Name *": shipment.name ?? "",
    "Address line 1 *": shipment.address ?? "",
    "Address line 2 *": "",
    "Postal code *": shipment.postalCode ?? "",
    "Contact person": shipment.name ?? "",
  };
  const contact = {
    "E-mail *": shipment.email ?? "",
    "Sender's reference": "",
    "Recipient's reference": "",
  };
  return parcelType === "postkasse"
    ? {
        ...shared,
        "Mobile number *": internationalPhone(shipment.phone),
        ...contact,
        "Bag on Door (yes/no)": "no",
      }
    : {
        "Number of items (per shipment) *": 1,
        ...shared,
        "Mobile number (incl. country code) *": internationalPhone(shipment.phone),
        ...contact,
      };
}

/** One row per open line, oldest order first within the SQL, before the customer columns. */
interface OpenLineRow {
  orderId: string;
  amount: number;
  customerId: string | null;
  schoolId: string;
  title: string;
  isbn: string | number;
  orderTime: Date;
}

export const OrderManagerService = {
  /** One page of open orders, newest first; the cursor continues from the previous page's last row. */
  async listOpenOrders(
    filter: OrderManagerFilter,
    cursor?: string,
    limit = ORDER_MANAGER_PAGE_SIZE,
  ): Promise<OrderManagerPage> {
    const { orders, bring } = await findOpenOrdersPage(
      filter,
      limit,
      // An infinite query sends an empty cursor for the first page
      cursor ? decodeCursor(cursor) : undefined,
    );
    const page = await presentRows(orders.slice(0, limit), bring);
    const last = page.at(-1);
    return {
      rows: page,
      nextCursor: orders.length > limit && last !== undefined ? encodeCursor(last) : null,
    };
  },

  /** The selected order as the order history shows it; null when there is no such order. */
  async getOrder(orderId: string): Promise<OrderManagerDetail | null> {
    const order = await Order.findOptional(orderId);
    if (!order) {
      return null;
    }
    return {
      customerId: order.customerId,
      order: await OrderHistoryService.presentOrder(order, "employee"),
    };
  },

  async ordersReport(filter: OrderManagerFilter): Promise<OrderManagerReportRow[]> {
    const query = whereOpenOrder(
      OrderItem.whereOpen(
        db
          .from("order_items")
          .join("orders", "orders.id", "order_items.order_id")
          .join("items", "items.id", "order_items.item_id"),
      ),
      filter,
    );
    if (filter.bringOnly) {
      void whereDeliveredBy(query, await bringDeliveriesOfOpenOrders(filter));
    }
    const lines: OpenLineRow[] = await query
      .select(
        "orders.id as orderId",
        "orders.amount",
        "orders.customer_id as customerId",
        "orders.branch_id as schoolId",
        "items.title",
        "items.isbn",
        "orders.created_at as orderTime",
      )
      .orderBy("orders.created_at", "desc")
      .orderBy("order_items.position");
    const paid = await paidOrderIds(
      [...new Map(lines.map((line) => [line.orderId, line])).values()].map((line) => ({
        id: line.orderId,
        amount: line.amount,
      })),
    );
    // The customer and the branch ids are replaced by their columns in place, so the CSV keeps
    // this column order.
    const rows = lines.map((line) => ({
      customerId: line.customerId,
      schoolId: line.schoolId,
      title: line.title,
      isbn: String(line.isbn),
      orderTime: line.orderTime.toISOString(),
      paid: paid.has(line.orderId),
      pivot: 1,
    }));
    const withCustomer = (
      await withUserColumns(rows, "customerId", customerReportColumns)
    ).toSorted((a, b) => (a.name ?? "").localeCompare(b.name ?? "", "nb"));
    const withMembership = await withBranchName(
      withCustomer,
      "branchMembershipId",
      "branchMembership",
    );
    return withBranchName(withMembership, "schoolId", "school");
  },

  async bringReport(
    filter: OrderManagerFilter,
    parcelType: BringParcelType,
  ): Promise<BringReportRow[]> {
    const deliveries = await bringDeliveriesOfOpenOrders(filter);
    const orders: { customerId: string | null; deliveryId: string }[] = await whereDeliveredBy(
      whereOpenOrder(db.from("orders"), filter),
      deliveries,
    )
      .select("orders.customer_id as customerId", "orders.delivery_id as deliveryId")
      .orderBy("orders.created_at", "desc")
      .orderBy("orders.id", "desc");
    const rows = orders.flatMap((order) => {
      const info = deliveries.get(order.deliveryId);
      const isMailbox = info?.product === MAILBOX_PRODUCT;
      if (info === undefined || isMailbox !== (parcelType === "postkasse")) {
        return [];
      }
      return [
        {
          name: info.shipmentAddress?.name ?? null,
          address: info.shipmentAddress?.address ?? null,
          postalCode: info.shipmentAddress?.postalCode ?? null,
          customerId: order.customerId,
        },
      ];
    });
    const shipments = await withUserColumns(rows, "customerId", (user) => ({
      phone: user?.phone ?? null,
      email: user?.email ?? null,
    }));
    return shipments.map((shipment) => toBringReportRow(shipment, parcelType));
  },
};
