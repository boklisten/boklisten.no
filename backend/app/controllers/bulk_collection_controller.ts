import type { HttpContext } from "@adonisjs/core/http";
import { DateTime } from "luxon";
import { ObjectId } from "mongodb";

import BlidService from "#services/blid_service";
import { CustomerItemActive } from "#services/legacy/collections/customer-item/helpers/customer-item-active";
import { CustomerItemActiveBlid } from "#services/legacy/collections/customer-item/helpers/customer-item-active-blid";
import { OrderPlaceOperation } from "#services/legacy/collections/order/operations/place/order-place.operation";
import { SEDbQueryBuilder } from "#services/legacy/query/se.db-query-builder";
import {
  ITEMS_LOCKED_TO_MATCH_RETURN_FEEDBACK,
  MatchLockService,
} from "#services/match_lock_service";
import { PermissionService } from "#services/permission_service";
import { StorageService } from "#services/storage_service";
import type {
  BulkCollectionCollectResponse,
  BulkCollectionLookupResponse,
  CollectedBook,
  CustomerCollectionReceipt,
  ScannedBook,
} from "#shared/bulk-collection/bulk-collection-dtos";
import { CustomerItem } from "#shared/customer-item/customer-item";
import { Item } from "#shared/item";
import { UserMatch } from "#shared/match/user-match";
import { OrderItem } from "#shared/order/order-item/order-item";
import { bulkCollectionCollectValidator } from "#validators/bulk_collection_validator";

export default class BulkCollectionController {
  private queryBuilder = new SEDbQueryBuilder();
  private customerItemActive = new CustomerItemActive();

  /**
   * Resolve a scanned BL-ID into a row for the to-deliver list, verifying the book is currently
   * in someone's possession.
   */
  async lookup(ctx: HttpContext): Promise<BulkCollectionLookupResponse> {
    PermissionService.employeeOrFail(ctx);
    const blid = ctx.request.param("blid");

    if (!BlidService.isValidBlid(blid)) {
      return { success: false, feedback: "Denne bliden er ikke gyldig." };
    }

    const [customerItem] = await new CustomerItemActiveBlid()
      .getActiveCustomerItems(blid)
      .catch(() => []);
    if (!customerItem) {
      return { success: false, feedback: "Boken er ikke aktiv." };
    }

    return { success: true, book: await this.resolveScannedBook(customerItem) };
  }

  /**
   * Collect (return) the given customer items. Items are grouped by customer and handout branch
   * into return orders that are placed through the existing order-place flow (which marks the
   * customer items returned, updates matches and sends the receipt email).
   */
  async collect(ctx: HttpContext): Promise<BulkCollectionCollectResponse> {
    const { permission, detailsId } = PermissionService.employeeOrFail(ctx);
    const { customerItemIds } = await ctx.request.validateUsing(bulkCollectionCollectValidator);

    const customerItems = await StorageService.CustomerItems.getMany(customerItemIds);

    if (customerItems.some((customerItem) => !this.customerItemActive.isActive(customerItem))) {
      return {
        success: false,
        feedback: "En eller flere av bøkene er ikke lenger aktive. Skann dem på nytt.",
      };
    }
    if (customerItems.some((customerItem) => !customerItem.handoutInfo?.handoutById)) {
      return {
        success: false,
        feedback: "En eller flere av bøkene mangler informasjon om hvor de ble delt ut.",
      };
    }

    const customerIds = [...new Set(customerItems.map((customerItem) => customerItem.customer))];
    const userMatches = await this.getUserMatchesForCustomers(customerIds);

    // Safety guard – the frontend only submits unlocked books, but re-check in case of a race.
    if (MatchLockService.findCustomerItemsLockedToMatch(customerItems, userMatches).length > 0) {
      return { success: false, feedback: ITEMS_LOCKED_TO_MATCH_RETURN_FEEDBACK };
    }

    const itemsMap = await this.getItemsMap(customerItems.map((customerItem) => customerItem.item));

    // Every order item requires a title; bail out with an actionable message rather than letting
    // the order fail validation with a generic 500 if an item could not be resolved.
    const itemsMissingTitle = customerItems.filter(
      (customerItem) => !itemsMap.get(customerItem.item)?.title,
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
    const user = { id: detailsId, details: detailsId, permission };
    const collectedAt = DateTime.now().setZone("Europe/Oslo").toFormat("HH:mm:ss");
    const placeOperation = new OrderPlaceOperation();
    const collectedByCustomer = new Map<string, CollectedBook[]>();

    for (const items of this.groupByCustomerAndBranch(customerItems).values()) {
      const { customer, handoutInfo } = items[0]!;
      const orderItems: OrderItem[] = items.map((customerItem) => ({
        type: customerItem.type === "partly-payment" ? "buyback" : "return",
        item: customerItem.item,
        blid: customerItem.blid,
        title: itemsMap.get(customerItem.item)?.title ?? "",
        amount: 0,
        unitPrice: 0,
        customerItem: customerItem.id,
      }));

      const order = await StorageService.Orders.add({
        amount: 0,
        orderItems,
        branch: handoutInfo!.handoutById,
        customer,
        byCustomer: false,
        payments: [],
        pendingSignature: false,
      });

      await placeOperation.run({ documentId: order.id, user });

      const collected = collectedByCustomer.get(customer) ?? [];
      for (const customerItem of items) {
        collected.push({
          title: itemsMap.get(customerItem.item)?.title ?? "",
          deadline: this.toIsoDeadline(customerItem.deadline),
          time: collectedAt,
          orderId: order.id,
        });
      }
      collectedByCustomer.set(customer, collected);
    }

    return { success: true, receipt: await this.buildReceipt(collectedByCustomer) };
  }

  private async resolveScannedBook(customerItem: CustomerItem): Promise<ScannedBook> {
    const branchId = customerItem.handoutInfo?.handoutById;
    const [item, branch, customerDetail, userMatches] = await Promise.all([
      StorageService.Items.get(customerItem.item),
      branchId ? StorageService.Branches.get(branchId) : Promise.resolve(undefined),
      StorageService.UserDetails.get(customerItem.customer),
      this.getUserMatchesForCustomers([customerItem.customer]),
    ]);

    return {
      customerItemId: customerItem.id,
      blid: customerItem.blid ?? "",
      item: customerItem.item,
      title: item.title,
      handoutBranchName: branch?.name ?? "Ukjent",
      deadline: this.toIsoDeadline(customerItem.deadline),
      customerId: customerItem.customer,
      customerName: customerDetail.name,
      lockedToMatch: MatchLockService.isItemLockedToMatch(
        customerItem.customer,
        customerItem.item,
        userMatches,
      ),
    };
  }

  private async buildReceipt(
    collectedByCustomer: Map<string, CollectedBook[]>,
  ): Promise<CustomerCollectionReceipt[]> {
    const receipt: CustomerCollectionReceipt[] = [];
    for (const [customerId, collectedBooks] of collectedByCustomer) {
      const [customerDetail, remainingBooks] = await Promise.all([
        StorageService.UserDetails.get(customerId),
        this.getRemainingBooks(customerId),
      ]);
      receipt.push({
        customerId,
        customerName: customerDetail.name,
        deliveredCount: collectedBooks.length,
        totalActiveCount: remainingBooks.length + collectedBooks.length,
        collectedBooks,
        remainingBooks,
      });
    }
    return receipt;
  }

  /** The customer's still-active books (after this collection), used for "Gjenværende bøker". */
  private async getRemainingBooks(customerId: string) {
    const databaseQuery = this.queryBuilder.getDbQuery({ customer: customerId }, [
      { fieldName: "customer", type: "object-id" },
    ]);
    const customerItems = await StorageService.CustomerItems.getByQuery(databaseQuery).catch(
      () => [] as CustomerItem[],
    );
    const remaining = customerItems.filter(
      (customerItem) => this.customerItemActive.isActive(customerItem) && customerItem.blid,
    );
    const itemsMap = await this.getItemsMap(remaining.map((customerItem) => customerItem.item));
    return remaining.map((customerItem) => ({
      title: itemsMap.get(customerItem.item)?.title ?? "",
      deadline: this.toIsoDeadline(customerItem.deadline),
    }));
  }

  private groupByCustomerAndBranch(customerItems: CustomerItem[]): Map<string, CustomerItem[]> {
    const groups = new Map<string, CustomerItem[]>();
    for (const customerItem of customerItems) {
      const key = `${customerItem.customer}__${customerItem.handoutInfo?.handoutById}`;
      groups.set(key, [...(groups.get(key) ?? []), customerItem]);
    }
    return groups;
  }

  private async getItemsMap(itemIds: string[]): Promise<Map<string, Item>> {
    const uniqueIds = [...new Set(itemIds)];
    // Use getOrNull (findById, which ignores the `active` flag) rather than getMany: a book that
    // a customer physically possesses must be returnable even if its catalog Item was deactivated.
    // getMany filters on `active: true` for non-admin employees and would silently drop such items,
    // leaving an empty title that fails the required-field validation when placing the order.
    const items = await Promise.all(uniqueIds.map((id) => StorageService.Items.getOrNull(id)));
    return new Map(
      items.filter((item): item is Item => item !== null).map((item) => [item.id, item]),
    );
  }

  private async getUserMatchesForCustomers(customerIds: string[]): Promise<UserMatch[]> {
    if (customerIds.length === 0) return [];
    const objectIds = customerIds.map((id) => new ObjectId(id));
    return (await StorageService.UserMatches.aggregate([
      {
        $match: {
          $or: [{ customerA: { $in: objectIds } }, { customerB: { $in: objectIds } }],
        },
      },
    ])) as UserMatch[];
  }

  private toIsoDeadline(deadline: Date): string {
    return DateTime.fromJSDate(new Date(deadline)).toISO() ?? "";
  }
}
