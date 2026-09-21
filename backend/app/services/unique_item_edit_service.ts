import { ObjectId } from "mongodb";

import Item from "#models/item";
import BadRequestException from "#exceptions/bad_request_exception";
import { SEDbQuery } from "#models/mongoose/storage/db-query";
import type UniqueItem from "#models/unique_item";
import type { MonitoredEmployee } from "#services/employee_monitoring_service";
import { isMonitored } from "#services/employee_monitoring_service";
import { findUniqueItemByBlid } from "#services/item_lookup";
import { StorageService } from "#services/storage_service";
import { UniqueItemMonitoring } from "#services/unique_item_monitoring";
import type { CustomerItem } from "#shared/customer-item/customer-item";

const HELD_BOOK_MESSAGE = "Boka er utdelt og kan ikke slettes";

async function uniqueItemOrFail(blid: string): Promise<UniqueItem> {
  const uniqueItem = await findUniqueItemByBlid(blid);
  if (!uniqueItem) {
    throw new BadRequestException(`Fant ingen bok med unik ID ${blid}`);
  }
  return uniqueItem;
}

/** The customer item, if any, of a customer who currently holds the book. */
async function findHeldCustomerItem(blid: string): Promise<CustomerItem | undefined> {
  const databaseQuery = new SEDbQuery();
  databaseQuery.stringFilters = [{ fieldName: "blid", value: blid }];
  const customerItems = (await StorageService.CustomerItems.getByQueryOrNull(databaseQuery)) ?? [];
  return customerItems.find(
    (customerItem) =>
      customerItem.handout &&
      !customerItem.returned &&
      !customerItem.buyout &&
      !customerItem.cancel &&
      !customerItem.buyback,
  );
}

/**
 * Corrections to which book a blid is, made from Boksøk. Deliberate data corrections: the
 * customer items follow the unique item, the orders behind them stay as they were.
 */
export const UniqueItemEditService = {
  /** Points the blid, and every customer item that carries it, at another book. */
  async relink(
    { blid, itemId }: { blid: string; itemId: string },
    employee: MonitoredEmployee,
  ): Promise<void> {
    const uniqueItem = await uniqueItemOrFail(blid);
    if (uniqueItem.itemId === itemId) {
      throw new BadRequestException("Boka er allerede koblet til denne tittelen");
    }
    const item = await Item.find(itemId);
    if (!item) {
      throw new BadRequestException("Fant ikke boka du valgte");
    }
    const previousItemId = uniqueItem.itemId;

    await uniqueItem.merge({ itemId: item.id }).save();
    const result = await StorageService.CustomerItems.updateMany(
      { blid },
      { $set: { item: new ObjectId(item.id), lastUpdated: new Date() } },
    );

    if (!isMonitored(employee)) {
      return;
    }
    const [previousItem, heldCustomerItem] = await Promise.all([
      Item.find(previousItemId),
      findHeldCustomerItem(blid),
    ]);
    await UniqueItemMonitoring.reportRelink({
      employee,
      customerId: heldCustomerItem?.customer ?? null,
      blid,
      previousTitle: previousItem?.title ?? "",
      title: item.title,
      customerItemCount: result.modifiedCount,
    });
  },

  /**
   * Deletes the blid. Refused while a customer holds the book; the customer items keep their
   * blid, so the book's history stays readable afterwards.
   */
  async remove({ blid }: { blid: string }, employee: MonitoredEmployee): Promise<void> {
    const uniqueItem = await uniqueItemOrFail(blid);
    if (await findHeldCustomerItem(blid)) {
      throw new BadRequestException(HELD_BOOK_MESSAGE);
    }

    await uniqueItem.delete();

    if (!isMonitored(employee)) {
      return;
    }
    // The deleted row keeps its attributes, so the book it sat on is still known.
    const item = await Item.find(uniqueItem.itemId);
    await UniqueItemMonitoring.reportDelete({
      employee,
      blid,
      title: item?.title ?? "",
    });
  },
};
