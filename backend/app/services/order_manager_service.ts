import type { PipelineStage } from "mongoose";
import { ObjectId } from "mongodb";

import BadRequestException from "#exceptions/bad_request_exception";
import { OrderHistoryService } from "#services/order_history_service";
import { StorageService } from "#services/storage_service";
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
import { OPEN_ORDER_ITEM_TYPES } from "#shared/order/open-order-item";

/** Mailbox parcels carry Bring product 3584; every other product (and none) goes to a pickup point. */
const MAILBOX_PRODUCT = "3584";

/**
 * An order item the stand still owes, as a query: same rule as `isOpenOrderItem`. `null` matches
 * both a missing and a null `movedToOrder`.
 */
const OPEN_ITEM_QUERY = {
  type: { $in: OPEN_ORDER_ITEM_TYPES },
  handout: { $ne: true },
  delivered: { $ne: true },
  movedToOrder: null,
};

/** The same rule as an expression, for filtering the array of one order. */
const OPEN_ITEM_CONDITION = {
  $and: [
    { $in: ["$$item.type", OPEN_ORDER_ITEM_TYPES] },
    { $ne: ["$$item.handout", true] },
    { $ne: ["$$item.delivered", true] },
    { $not: [{ $ifNull: ["$$item.movedToOrder", false] }] },
  ],
};

/** Paid by the rule the stand has always used: nothing to pay, or any payment recorded. */
const PAID_EXPRESSION = {
  $or: [{ $lte: ["$amount", 0] }, { $gt: [{ $size: { $ifNull: ["$payments", []] } }, 0] }],
};

const firstOrNull = (path: string) => ({ $ifNull: [{ $first: path }, null] });

const asObjectId = (path: string) => ({
  $convert: { input: path, to: "objectId", onError: null, onNull: null },
});

function lookupOne(from: string, localField: string, as: string, fields: string[]) {
  return {
    $lookup: {
      from,
      localField,
      foreignField: "_id",
      as,
      pipeline: [{ $project: Object.fromEntries(fields.map((field) => [field, 1])) }],
    },
  };
}

const DELIVERY_LOOKUP = lookupOne("deliveries", "delivery", "deliveryInfo", ["method", "info"]);
const BRANCH_LOOKUP = lookupOne("branches", "branch", "branchInfo", ["name"]);
const BRING_ONLY_MATCH = { $match: { "deliveryInfo.method": "bring" } };

/** Legacy orders may hold the customer id as a string, so it is cast before the join. */
function customerLookup(fields: string[]): PipelineStage[] {
  return [
    { $addFields: { customerId: asObjectId("$customer") } },
    lookupOne("userdetails", "customerId", "customerInfo", fields),
  ];
}
const CONTACT_FIELDS = ["name", "email", "phone", "address"];

interface Cursor {
  creationTime: Date;
  id: ObjectId;
}

const CURSOR_SEPARATOR = "_";

function encodeCursor(row: OrderManagerRow): string {
  return `${row.creationTime}${CURSOR_SEPARATOR}${row.id}`;
}

function decodeCursor(cursor: string): Cursor {
  const separator = cursor.lastIndexOf(CURSOR_SEPARATOR);
  const creationTime = new Date(cursor.slice(0, separator));
  const id = cursor.slice(separator + 1);
  if (separator === -1 || Number.isNaN(creationTime.getTime()) || !ObjectId.isValid(id)) {
    throw new BadRequestException("Ugyldig posisjon i listen");
  }
  return { creationTime, id: new ObjectId(id) };
}

/** Placed orders with a book still owed, on the wanted branches, older than the cursor. */
function openOrdersMatch(filter: OrderManagerFilter, cursor?: Cursor): PipelineStage.Match {
  return {
    $match: {
      placed: true,
      orderItems: { $elemMatch: OPEN_ITEM_QUERY },
      ...(filter.branchIds && filter.branchIds.length > 0
        ? { branch: { $in: filter.branchIds.map((id) => new ObjectId(id)) } }
        : {}),
      ...(cursor
        ? {
            $or: [
              { creationTime: { $lt: cursor.creationTime } },
              { creationTime: cursor.creationTime, _id: { $lt: cursor.id } },
            ],
          }
        : {}),
    },
  };
}

/** Bring-only needs the delivery joined before it can narrow. */
function bringOnlyStages(filter: OrderManagerFilter): PipelineStage[] {
  return filter.bringOnly ? [DELIVERY_LOOKUP, BRING_ONLY_MATCH] : [];
}

export function openOrdersPipeline(
  filter: OrderManagerFilter,
  limit: number,
  cursor?: Cursor,
): PipelineStage[] {
  // One more than the page, to know whether there is a next page without a count query
  const cutPage = { $limit: limit + 1 };
  return [
    openOrdersMatch(filter, cursor),
    { $sort: { creationTime: -1, _id: -1 } },
    // Bring-only narrows before the page is cut; otherwise the delivery is joined only for the badge
    ...(filter.bringOnly
      ? [DELIVERY_LOOKUP, BRING_ONLY_MATCH, cutPage]
      : [cutPage, DELIVERY_LOOKUP]),
    ...customerLookup(["name"]),
    BRANCH_LOOKUP,
    {
      $project: {
        _id: 0,
        id: { $toString: "$_id" },
        creationTime: { $dateToString: { date: "$creationTime" } },
        customer: {
          id: { $toString: "$customer" },
          name: { $ifNull: [{ $first: "$customerInfo.name" }, "Ukjent kunde"] },
        },
        branch: { id: { $toString: "$branch" }, name: firstOrNull("$branchInfo.name") },
        openItems: {
          $map: {
            input: { $filter: { input: "$orderItems", as: "item", cond: OPEN_ITEM_CONDITION } },
            as: "item",
            in: {
              itemId: { $toString: "$$item.item" },
              title: "$$item.title",
              type: "$$item.type",
            },
          },
        },
        bring: { $eq: [{ $first: "$deliveryInfo.method" }, "bring"] },
        unpaid: { $not: [PAID_EXPRESSION] },
      },
    },
  ];
}

export function ordersReportPipeline(filter: OrderManagerFilter): PipelineStage[] {
  return [
    openOrdersMatch(filter),
    ...bringOnlyStages(filter),
    { $unwind: "$orderItems" },
    {
      $match: Object.fromEntries(
        Object.entries(OPEN_ITEM_QUERY).map(([field, condition]) => [
          `orderItems.${field}`,
          condition,
        ]),
      ),
    },
    ...customerLookup([...CONTACT_FIELDS, "dob", "branchMembership"]),
    BRANCH_LOOKUP,
    lookupOne("branches", "customerInfo.branchMembership", "membershipInfo", ["name"]),
    lookupOne("items", "orderItems.item", "itemInfo", ["info.isbn"]),
    {
      $project: {
        _id: 0,
        name: firstOrNull("$customerInfo.name"),
        email: firstOrNull("$customerInfo.email"),
        phone: firstOrNull("$customerInfo.phone"),
        address: firstOrNull("$customerInfo.address"),
        dob: {
          $dateToString: {
            date: { $first: "$customerInfo.dob" },
            format: "%d.%m.%Y",
            timezone: "Europe/Oslo",
            onNull: null,
          },
        },
        branchMembership: firstOrNull("$membershipInfo.name"),
        school: firstOrNull("$branchInfo.name"),
        title: "$orderItems.title",
        isbn: {
          $convert: {
            input: { $first: "$itemInfo.info.isbn" },
            to: "string",
            onError: null,
            onNull: null,
          },
        },
        orderTime: { $dateToString: { date: "$creationTime" } },
        paid: PAID_EXPRESSION,
        pivot: { $literal: 1 },
      },
    },
    { $sort: { name: 1, orderTime: -1 } },
  ];
}

/** What the Bring rows are built from; the Mybring headers differ per parcel type. */
interface BringShipment {
  name: string | null;
  address: string | null;
  postalCode: string | null;
  phone: string | null;
  email: string | null;
}

export function bringReportPipeline(
  filter: OrderManagerFilter,
  parcelType: BringParcelType,
): PipelineStage[] {
  return [
    openOrdersMatch(filter),
    DELIVERY_LOOKUP,
    BRING_ONLY_MATCH,
    {
      $match: {
        "deliveryInfo.info.product":
          parcelType === "postkasse" ? MAILBOX_PRODUCT : { $ne: MAILBOX_PRODUCT },
      },
    },
    { $sort: { creationTime: -1, _id: -1 } },
    ...customerLookup(CONTACT_FIELDS),
    {
      $project: {
        _id: 0,
        name: firstOrNull("$deliveryInfo.info.shipmentAddress.name"),
        address: firstOrNull("$deliveryInfo.info.shipmentAddress.address"),
        postalCode: firstOrNull("$deliveryInfo.info.shipmentAddress.postalCode"),
        phone: firstOrNull("$customerInfo.phone"),
        email: firstOrNull("$customerInfo.email"),
      },
    },
  ];
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
    const rows = await StorageService.Orders.aggregate<OrderManagerRow>(
      // An infinite query sends an empty cursor for the first page
      openOrdersPipeline(filter, limit, cursor ? decodeCursor(cursor) : undefined),
    );
    const page = rows.slice(0, limit);
    const last = page.at(-1);
    return {
      rows: page,
      nextCursor: rows.length > limit && last !== undefined ? encodeCursor(last) : null,
    };
  },

  /** The selected order as the order history shows it; null when there is no such order. */
  async getOrder(orderId: string): Promise<OrderManagerDetail | null> {
    const order = await StorageService.Orders.getOrNull(orderId);
    if (!order) {
      return null;
    }
    return {
      customerId: order.customer,
      order: await OrderHistoryService.presentOrder(order, "employee"),
    };
  },

  async ordersReport(filter: OrderManagerFilter): Promise<OrderManagerReportRow[]> {
    return StorageService.Orders.aggregate<OrderManagerReportRow>(ordersReportPipeline(filter));
  },

  async bringReport(
    filter: OrderManagerFilter,
    parcelType: BringParcelType,
  ): Promise<BringReportRow[]> {
    const shipments = await StorageService.Orders.aggregate<BringShipment>(
      bringReportPipeline(filter, parcelType),
    );
    return shipments.map((shipment) => toBringReportRow(shipment, parcelType));
  },
};
