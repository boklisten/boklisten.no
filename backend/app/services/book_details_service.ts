import db from "@adonisjs/lucid/services/db";
import type { DateTime } from "luxon";

import Branch from "#models/branch";
import CustomerItem from "#models/customer_item";
import Order from "#models/order";
import User from "#models/user";
import { calculateStatus } from "#services/customer_item_actions_service";
import type {
  BookGiver,
  BookInvoiceEntry,
  BookInvoiceSummary,
  CustomerItemDetails,
  OrderedItemDetails,
} from "#shared/book-details";
import { isOpenOrderItem } from "#shared/order/open-order-item";

/**
 * Who is looking. Customers see only their own books, and never which employee served them; the
 * stand sees everything.
 */
export type BookDetailsViewer = { role: "customer"; userId: string } | { role: "employee" };

const toIso = (time: DateTime): string => time.toISO({ suppressMilliseconds: true }) ?? "";
const optionalIso = (time: DateTime | null) => (time ? toIso(time) : null);

interface InvoiceRow {
  customerItemId: string;
  id: string;
  invoiceNumber: string;
  status: BookInvoiceSummary["status"];
  dueDate: string;
  amount: number;
}

/** Invoice lines that still stand: not cancelled, on an invoice that was not credited. Newest first. */
function standingInvoiceLines(customerItemIds: string[]) {
  return db
    .from("invoice_lines")
    .join("invoices", "invoices.id", "invoice_lines.invoice_id")
    .whereIn("invoice_lines.customer_item_id", customerItemIds)
    .where("invoice_lines.cancelled", false)
    .whereNot("invoices.status", "credit-note")
    .orderBy("invoices.created_at", "desc")
    .select(
      "invoice_lines.customer_item_id as customerItemId",
      "invoices.id",
      "invoices.invoice_number as invoiceNumber",
      "invoices.status",
      db.raw("to_char(invoices.due_date, 'YYYY-MM-DD') as \"dueDate\""),
      "invoice_lines.gross as amount",
    );
}

/** The newest standing invoice of each customer item, for the badge on its row. */
async function invoiceSummariesOf(
  customerItemIds: string[],
): Promise<Map<string, BookInvoiceSummary>> {
  if (customerItemIds.length === 0) {
    return new Map();
  }
  const rows: InvoiceRow[] = await standingInvoiceLines(customerItemIds);
  const summaries = new Map<string, BookInvoiceSummary>();
  for (const row of rows) {
    if (!summaries.has(row.customerItemId)) {
      summaries.set(row.customerItemId, {
        id: row.id,
        invoiceNumber: row.invoiceNumber,
        status: row.status,
      });
    }
  }
  return summaries;
}

/**
 * Who put the book in the customer's hands: the student it came from when an overlevering did,
 * otherwise the employee on the customer item. Customers are not told which employee it was.
 */
async function giverOf(
  customerItem: CustomerItem,
  orderIds: string[],
  viewer: BookDetailsViewer,
): Promise<BookGiver | null> {
  if (customerItem.customerId !== null && orderIds.length > 0) {
    const handover: { fromUserId: string | null } | null = await db
      .from("book_handovers")
      .whereIn("order_id", orderIds)
      .where("to_user_id", customerItem.customerId)
      .whereNotNull("from_user_id")
      .orderBy("occurred_at")
      .select("from_user_id as fromUserId")
      .first();
    if (handover?.fromUserId) {
      const names = await User.namesByIds([handover.fromUserId]);
      return {
        kind: "peer",
        userId: viewer.role === "employee" ? handover.fromUserId : null,
        name: names.get(handover.fromUserId) ?? "en annen elev",
      };
    }
  }
  if (viewer.role === "customer" || customerItem.handoutEmployeeId === null) {
    return null;
  }
  const names = await User.namesByIds([customerItem.handoutEmployeeId]);
  const name = names.get(customerItem.handoutEmployeeId);
  return name === undefined
    ? null
    : { kind: "employee", userId: customerItem.handoutEmployeeId, name };
}

/**
 * How the loan ended. A cancelled or bought-back book is also marked returned, so those two are
 * told apart first; a buyout outranks them all.
 */
function endingOf(
  customerItem: CustomerItem,
  returnBranchName: string | null,
): CustomerItemDetails["ended"] {
  if (customerItem.buyout) {
    return { kind: "buyout", at: optionalIso(customerItem.boughtOutAt), branchName: null };
  }
  if (customerItem.cancel) {
    return { kind: "cancel", at: optionalIso(customerItem.cancelledAt), branchName: null };
  }
  if (customerItem.buyback) {
    return { kind: "buyback", at: optionalIso(customerItem.boughtBackAt), branchName: null };
  }
  if (customerItem.returned) {
    return {
      kind: "returned",
      at: optionalIso(customerItem.returnedAt),
      branchName: returnBranchName,
    };
  }
  return null;
}

const BookDetailsService = {
  invoiceSummariesOf,

  async forCustomerItem(
    customerItemId: string,
    viewer: BookDetailsViewer,
  ): Promise<CustomerItemDetails | null> {
    const customerItem = await CustomerItem.query()
      .where("id", customerItemId)
      .preload("item")
      .preload("handoutBranch")
      .first();
    if (
      !customerItem ||
      (viewer.role === "customer" && customerItem.customerId !== viewer.userId)
    ) {
      return null;
    }

    const orderIds = (await CustomerItem.orderIdsOf([customerItem.id])).get(customerItem.id) ?? [];
    const [by, invoiceRows, returnBranch] = await Promise.all([
      giverOf(customerItem, orderIds, viewer),
      standingInvoiceLines([customerItem.id]) as Promise<InvoiceRow[]>,
      customerItem.returnBranchId === null ? null : Branch.find(customerItem.returnBranchId),
    ]);
    const { item, handoutBranch } = customerItem;
    return {
      kind: "customer-item",
      id: customerItem.id,
      customerId: customerItem.customerId,
      itemId: item.id,
      title: item.title,
      isbn: item.isbnText,
      blid: customerItem.blid,
      type: customerItem.type,
      status: calculateStatus(customerItem),
      deadline: customerItem.deadline.toISODate()!,
      branch: { id: handoutBranch.id, name: handoutBranch.name },
      handout: { at: toIso(customerItem.handedOutAt), by },
      ended: endingOf(customerItem, returnBranch?.name ?? null),
      invoices: invoiceRows.map((invoice): BookInvoiceEntry => ({
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        status: invoice.status,
        dueDate: invoice.dueDate,
        amount: invoice.amount,
      })),
    };
  },

  async forOrderedItem(
    orderId: string,
    itemId: string,
    viewer: BookDetailsViewer,
  ): Promise<OrderedItemDetails | null> {
    const order = await Order.findOptional(orderId);
    if (!order || (viewer.role === "customer" && order.customerId !== viewer.userId)) {
      return null;
    }
    const orderItem = order.orderItems.find(
      (candidate) => candidate.itemId === itemId && isOpenOrderItem(candidate),
    );
    if (!orderItem) {
      return null;
    }
    const branch = await Branch.find(order.branchId);
    return {
      kind: "ordered",
      orderId: order.id,
      customerId: order.customerId,
      itemId,
      title: orderItem.title,
      isbn: orderItem.isbn,
      type: orderItem.type,
      deadline: orderItem.periodTo?.toISODate() ?? null,
      branch: { id: order.branchId, name: branch?.name ?? "" },
    };
  },
};

export default BookDetailsService;
