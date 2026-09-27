import type { HttpContext } from "@adonisjs/core/http";
import { DateTime } from "luxon";

import Branch from "#models/branch";
import CustomerItem from "#models/customer_item";
import ItemModel from "#models/item";
import Order from "#models/order";
import type { NewOrderItem } from "#models/order";
import User from "#models/user";
import BlidService from "#services/blid_service";
import { BulkCollectionMonitoring } from "#services/bulk_collection_monitoring";
import { OrderPlaceService } from "#services/orders/order_place_service";
import { PeerObligations } from "#services/matches/peer_obligations";
import type {
  BulkCollectionCollectResponse,
  BulkCollectionLookupResponse,
  CollectedBook,
  CustomerCollectionReceipt,
  ScannedBook,
} from "#shared/bulk-collection/bulk-collection-dtos";
import type { Item } from "#shared/item";
import { bulkCollectionCollectValidator } from "#validators/bulk_collection_validator";

export default class BulkCollectionController {
  /**
   * Resolve a scanned BL-ID into a row for the to-deliver list, verifying the book is currently
   * in someone's possession.
   */
  async show(ctx: HttpContext): Promise<BulkCollectionLookupResponse> {
    const blid = ctx.request.param("blid");

    if (!BlidService.isValidBlid(blid)) {
      return { success: false, feedback: "Denne bliden er ikke gyldig." };
    }

    const [customerItem] = await CustomerItem.activeByBlid(blid);
    if (!customerItem?.customerId) {
      return { success: false, feedback: "Boken er ikke aktiv." };
    }

    return {
      success: true,
      book: await this.resolveScannedBook(customerItem, customerItem.customerId),
    };
  }

  /**
   * Collect (return) the given customer items. Items are grouped by customer and handout branch
   * into return orders that are placed through the existing order-place flow (which marks the
   * customer items returned, updates matches and sends the receipt email).
   */
  async collect(ctx: HttpContext): Promise<BulkCollectionCollectResponse> {
    const { id: detailsId, permission } = ctx.auth.getUserOrFail();
    const { customerItemIds } = await ctx.request.validateUsing(bulkCollectionCollectValidator);

    const customerItems = await CustomerItem.findByIds(customerItemIds);

    if (
      customerItems.length !== new Set(customerItemIds).size ||
      customerItems.some((customerItem) => !customerItem.isActive || !customerItem.customerId)
    ) {
      return {
        success: false,
        feedback: "En eller flere av bøkene er ikke lenger aktive. Skann dem på nytt.",
      };
    }

    const itemsMap = await this.getItemsMap(
      customerItems.map((customerItem) => customerItem.itemId),
    );

    // Every order item requires a title; bail out with an actionable message rather than letting
    // the order fail validation with a generic 500 if an item could not be resolved.
    const itemsMissingTitle = customerItems.filter(
      (customerItem) => !itemsMap.get(customerItem.itemId)?.title,
    );
    if (itemsMissingTitle.length > 0) {
      const blids = itemsMissingTitle.map((customerItem) => customerItem.blid).join(", ");
      return {
        success: false,
        feedback: `Fant ikke boktittel for én eller flere bøker (BL-ID: ${blids}). Kontakt en administrator.`,
      };
    }

    // The employee's user id is not used when placing pure return/buyback orders (no new customer
    // items are generated), so the detailsId is sufficient for the place operation.
    const user = { id: detailsId, permission };
    const collectedAt = DateTime.now().toFormat("HH:mm:ss");
    const orderPlaceService = new OrderPlaceService();
    const collectedByCustomer = new Map<string, CollectedBook[]>();

    for (const items of this.groupByCustomerAndBranch(customerItems).values()) {
      const { customerId, handoutBranchId } = items[0]!;
      const customer = customerId ?? "";
      const orderItems: NewOrderItem[] = items.map((customerItem) => ({
        type: customerItem.type === "partly-payment" ? "buyback" : "return",
        itemId: customerItem.itemId,
        blid: customerItem.blid,
        amount: 0,
        unitPrice: 0,
        customerItemId: customerItem.id,
        handout: false,
        delivered: false,
      }));

      const order = await Order.createWithItems({
        amount: 0,
        orderItems,
        branchId: handoutBranchId,
        customerId: customer,
        byCustomer: false,
        // The book's history and the customer's order history name the employee from the order.
        employeeId: detailsId,
        placed: false,
      });

      await orderPlaceService.place(order.id, user);
      await BulkCollectionMonitoring.reportOverdueBooks({
        employee: { detailsId, permission },
        customerItems: items,
        titles: new Map([...itemsMap].map(([id, item]) => [id, item.title])),
        now: new Date(),
      });

      const collected = collectedByCustomer.get(customer) ?? [];
      for (const customerItem of items) {
        collected.push({
          title: itemsMap.get(customerItem.itemId)?.title ?? "",
          deadline: this.toIsoDeadline(customerItem.deadline),
          time: collectedAt,
          orderId: order.id,
        });
      }
      collectedByCustomer.set(customer, collected);
    }

    return { success: true, receipt: await this.buildReceipt(collectedByCustomer) };
  }

  private async resolveScannedBook(
    customerItem: CustomerItem,
    customerId: string,
  ): Promise<ScannedBook> {
    const [item, branch, customerDetail, recipientCustomerId] = await Promise.all([
      ItemModel.findOrFail(customerItem.itemId),
      Branch.findOptional(customerItem.handoutBranchId),
      User.findOrFail(customerId),
      PeerObligations.findPeerRecipient(customerId, customerItem.itemId),
    ]);
    const deliverTo = recipientCustomerId ? await User.find(recipientCustomerId) : null;

    return {
      customerItemId: customerItem.id,
      blid: customerItem.blid ?? "",
      item: customerItem.itemId,
      title: item.title,
      handoutBranchName: branch?.name ?? "Ukjent",
      deadline: this.toIsoDeadline(customerItem.deadline),
      customerId,
      customerName: customerDetail.name,
      deliverToName: deliverTo?.name ?? (recipientCustomerId ? "en annen elev" : undefined),
    };
  }

  private async buildReceipt(
    collectedByCustomer: Map<string, CollectedBook[]>,
  ): Promise<CustomerCollectionReceipt[]> {
    const customerIds = [...collectedByCustomer.keys()];
    const [names, stillActive] = await Promise.all([
      User.namesByIds(customerIds),
      CustomerItem.whereActive(
        CustomerItem.query().whereIn("customer_id", customerIds).whereNotNull("blid"),
      )
        .preload("item")
        .orderBy("deadline"),
    ]);
    return [...collectedByCustomer].map(([customerId, collectedBooks]) => {
      const remainingBooks = stillActive
        .filter((customerItem) => customerItem.customerId === customerId)
        .map((customerItem) => ({
          title: customerItem.item.title,
          deadline: this.toIsoDeadline(customerItem.deadline),
        }));
      return {
        customerId,
        customerName: names.get(customerId) ?? "",
        deliveredCount: collectedBooks.length,
        totalActiveCount: remainingBooks.length + collectedBooks.length,
        collectedBooks,
        remainingBooks,
      };
    });
  }

  private groupByCustomerAndBranch(customerItems: CustomerItem[]): Map<string, CustomerItem[]> {
    const groups = new Map<string, CustomerItem[]>();
    for (const customerItem of customerItems) {
      const key = `${customerItem.customerId}__${customerItem.handoutBranchId}`;
      groups.set(key, [...(groups.get(key) ?? []), customerItem]);
    }
    return groups;
  }

  private async getItemsMap(itemIds: string[]): Promise<Map<string, Item>> {
    // Deliberately not filtered on `active`: a book a customer physically possesses must be
    // returnable even if its catalogue item was deactivated.
    return ItemModel.byIds(itemIds);
  }

  private toIsoDeadline(deadline: DateTime): string {
    return deadline.toISO() ?? "";
  }
}
