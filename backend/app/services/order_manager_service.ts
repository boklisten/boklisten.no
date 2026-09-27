import db from "@adonisjs/lucid/services/db";
import type { ChainableContract } from "@adonisjs/lucid/types/querybuilder";

import BadRequestException from "#exceptions/bad_request_exception";
import Branch from "#models/branch";
import { isObjectIdHex } from "#models/helpers/object_id";
import Order from "#models/order";
import OrderItem from "#models/order_item";
import User from "#models/user";
import { OrderHistoryService } from "#services/order_history_service";
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

/** Only the orders shipped with Bring, for the joined queries of the exports. */
function whereShippedByBring<Query extends ChainableContract>(query: Query): Query {
  return query.whereExists((deliveries) => {
    void deliveries
      .from("deliveries")
      .whereColumn("deliveries.order_id", "orders.id")
      .where("deliveries.method", "bring");
  });
}

/** Paid by the rule the stand has always used: nothing to pay, or any payment recorded. */
const PAID_SQL =
  "(orders.amount <= 0 OR EXISTS (SELECT 1 FROM payments WHERE payments.order_id = orders.id))";

/** A count the list page selects with `withCount`; Postgres returns counts as strings. */
function counted(order: Order, name: "payments_count" | "bring_deliveries"): boolean {
  return Number(order.$extras[name]) > 0;
}

async function presentRows(orders: Order[]): Promise<OrderManagerRow[]> {
  const [branchNames, customerNames] = await Promise.all([
    Branch.namesByIds(orders.map((order) => order.branchId)),
    User.namesByIds(orders.map((order) => order.customerId)),
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
    bring: counted(order, "bring_deliveries"),
    // The negation of PAID_SQL.
    unpaid: order.amount > 0 && !counted(order, "payments_count"),
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
async function findOpenOrdersPage(
  filter: OrderManagerFilter,
  limit: number,
  cursor?: Cursor,
): Promise<Order[]> {
  const query = whereOpenOrder(Order.query(), filter)
    .withCount("payments")
    .withCount("delivery", (delivery) => {
      void delivery.where("method", "bring").as("bring_deliveries");
    });
  if (filter.bringOnly) {
    void query.whereHas("delivery", (delivery) => {
      void delivery.where("method", "bring");
    });
  }
  if (cursor) {
    void query.whereRaw("(orders.created_at, orders.id) < (?, ?)", [cursor.createdAt, cursor.id]);
  }
  return query
    .orderBy("createdAt", "desc")
    .orderBy("id", "desc")
    .limit(limit + 1);
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

export const OrderManagerService = {
  /** One page of open orders, newest first; the cursor continues from the previous page's last row. */
  async listOpenOrders(
    filter: OrderManagerFilter,
    cursor?: string,
    limit = ORDER_MANAGER_PAGE_SIZE,
  ): Promise<OrderManagerPage> {
    const orders = await findOpenOrdersPage(
      filter,
      limit,
      // An infinite query sends an empty cursor for the first page
      cursor ? decodeCursor(cursor) : undefined,
    );
    const page = await presentRows(orders.slice(0, limit));
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
          .join("items", "items.id", "order_items.item_id")
          .join("branches as schools", "schools.id", "orders.branch_id")
          .leftJoin("users as customers", "customers.id", "orders.customer_id")
          .leftJoin("branches as memberships", "memberships.id", "customers.branch_membership_id"),
      ),
      filter,
    );
    if (filter.bringOnly) {
      void whereShippedByBring(query);
    }
    // In the order the CSV lists the columns.
    const lines: OrderManagerReportRow[] = await query
      .select(
        "customers.name",
        "customers.email",
        "customers.phone",
        "customers.address",
        db.raw(`to_char(customers.dob, 'DD.MM.YYYY') as dob`),
        "memberships.name as branchMembership",
        "schools.name as school",
        "items.title",
        db.raw("items.isbn::text as isbn"),
        "orders.created_at as orderTime",
        db.raw(`${PAID_SQL} as paid`),
        db.raw("1 as pivot"),
      )
      .orderBy("orders.created_at", "desc")
      .orderBy("order_items.position");
    return lines.toSorted((a, b) => (a.name ?? "").localeCompare(b.name ?? "", "nb"));
  },

  async bringReport(
    filter: OrderManagerFilter,
    parcelType: BringParcelType,
  ): Promise<BringReportRow[]> {
    const query = whereOpenOrder(db.from("orders"), filter)
      .join("deliveries", "deliveries.order_id", "orders.id")
      .where("deliveries.method", "bring")
      .leftJoin("users as customers", "customers.id", "orders.customer_id");
    if (parcelType === "postkasse") {
      void query.where("deliveries.product", MAILBOX_PRODUCT);
    } else {
      void query.whereRaw("deliveries.product IS DISTINCT FROM ?", [MAILBOX_PRODUCT]);
    }
    const shipments: BringShipment[] = await query
      .select(
        "deliveries.shipment_name as name",
        "deliveries.shipment_address as address",
        "deliveries.shipment_postal_code as postalCode",
        "customers.phone",
        "customers.email",
      )
      .orderBy("orders.created_at", "desc")
      .orderBy("orders.id", "desc");
    return shipments.map((shipment) => toBringReportRow(shipment, parcelType));
  },
};
