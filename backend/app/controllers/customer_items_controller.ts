import type { HttpContext } from "@adonisjs/core/http";
import { ObjectId } from "mongodb";

import { BlSchemaName } from "#models/mongoose/storage/bl-schema-names";
import { buildCustomerItemActions, calculateStatus } from "#services/customer_item_actions_service";
import { SEDbQuery } from "#services/legacy/query/se.db-query";
import { PermissionService } from "#services/permission_service";
import { StorageService } from "#services/storage_service";
import type { ActiveCustomerItem } from "#shared/customer-item/active-customer-item";
import type { CustomerItemAction } from "#shared/customer-item/actionable_customer_item";

export default class CustomerItemsController {
  async getCustomerItems(ctx: HttpContext) {
    const { detailsId } = PermissionService.authenticate(ctx);
    const databaseQuery = new SEDbQuery();
    databaseQuery.stringFilters = [{ fieldName: "customer", value: detailsId }];
    databaseQuery.sortFilters = [{ fieldName: "lastUpdated", direction: -1 }];
    const customerItems = await StorageService.CustomerItems.getByQueryOrNull(databaseQuery);
    if (!customerItems) {
      return [];
    }

    return Promise.all(
      customerItems.map(async (customerItem) => {
        const item = await StorageService.Items.get(customerItem.item);
        const branch = await StorageService.Branches.get(customerItem.handoutInfo?.handoutById);
        return {
          id: customerItem.id,
          item: {
            id: item.id,
            title: item.title,
            isbn: item.info.isbn.toString(),
          },
          blid: customerItem.blid,
          deadline: customerItem.deadline,
          handoutAt: customerItem.handoutInfo?.time,
          branch: {
            id: branch.id,
            name: branch.name,
          },
          status: calculateStatus(customerItem),
          actions: await buildCustomerItemActions(customerItem, branch),
        };
      }),
    );
  }

  /**
   * The books a given customer is currently holding, for employees working the stand.
   * Separate from getCustomerItems because that one is scoped to the caller's own token and
   * leaves out the rental type.
   */
  async getActiveCustomerItemsForCustomer(ctx: HttpContext) {
    PermissionService.employeeOrFail(ctx);
    const detailsId = String(ctx.request.param("detailsId"));
    if (!ObjectId.isValid(detailsId)) {
      return [];
    }

    const rows = await StorageService.CustomerItems.aggregate<Omit<ActiveCustomerItem, "actions">>([
      {
        $match: {
          returned: { $ne: true },
          buyout: { $ne: true },
          cancel: { $ne: true },
          buyback: { $ne: true },
          handout: true,
          customer: new ObjectId(detailsId),
        },
      },
      // The $lookup below overwrites "item" with the joined document, so the id is kept aside
      { $addFields: { itemId: "$item" } },
      {
        $lookup: {
          from: BlSchemaName.Items,
          localField: "item",
          foreignField: "_id",
          as: "item",
        },
      },
      { $unwind: { path: "$item", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          id: { $toString: "$_id" },
          item: { $toString: "$itemId" },
          title: { $ifNull: ["$item.title", "Ukjent bok"] },
          blid: { $ifNull: ["$blid", null] },
          type: "$type",
          deadline: "$deadline",
        },
      },
      { $sort: { deadline: 1, title: 1 } },
    ]);
    if (rows.length === 0) {
      return [];
    }

    // The rules need the full documents, so they are priced after the listing query
    const customerItems = await StorageService.CustomerItems.getMany(rows.map((row) => row.id));
    const actionsById = new Map<string, CustomerItemAction[]>();
    for (const customerItem of customerItems) {
      const branch = await StorageService.Branches.getOrNull(customerItem.handoutInfo?.handoutById);
      actionsById.set(customerItem.id, await buildCustomerItemActions(customerItem, branch));
    }

    return rows.map((row): ActiveCustomerItem =>
      Object.assign(row, { actions: actionsById.get(row.id) ?? [] }),
    );
  }
}
