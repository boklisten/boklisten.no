import type { HttpContext } from "@adonisjs/core/http";
import { ObjectId } from "mongodb";

import Branch from "#models/branch";
import Item from "#models/item";
import { buildCustomerItemActions, calculateStatus } from "#services/customer_item_actions_service";
import { SEDbQuery } from "#models/mongoose/storage/db-query";
import { StorageService } from "#services/storage_service";
import type { ActiveCustomerItem } from "#shared/customer-item/active-customer-item";
import type { CustomerItemAction } from "#shared/customer-item/actionable_customer_item";

export default class CustomerItemsController {
  /** The caller's own books, with the actions they can take on them. */
  async me(ctx: HttpContext) {
    const { id: detailsId } = ctx.auth.getUserOrFail();
    const databaseQuery = new SEDbQuery();
    databaseQuery.stringFilters = [{ fieldName: "customer", value: detailsId }];
    databaseQuery.sortFilters = [{ fieldName: "lastUpdated", direction: -1 }];
    const customerItems = await StorageService.CustomerItems.getByQueryOrNull(databaseQuery);
    if (!customerItems) {
      return [];
    }

    return Promise.all(
      customerItems.map(async (customerItem) => {
        const item = await Item.findOrFail(customerItem.item);
        const branch = await Branch.getOrFail(customerItem.handoutInfo?.handoutById);
        return {
          id: customerItem.id,
          item: {
            id: item.id,
            title: item.title,
            isbn: String(item.isbn),
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
   * Separate from `me` because that one is scoped to the caller's own token and leaves out the
   * rental type.
   */
  async forCustomer(ctx: HttpContext) {
    const detailsId = String(ctx.request.param("detailsId"));
    if (!ObjectId.isValid(detailsId)) {
      return [];
    }

    const rows = await StorageService.CustomerItems.aggregate<
      Omit<ActiveCustomerItem, "actions" | "title" | "handoutBranch"> & {
        handoutBranchId: string | null;
      }
    >([
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
      {
        $project: {
          _id: 0,
          id: { $toString: "$_id" },
          item: { $toString: "$item" },
          blid: { $ifNull: ["$blid", null] },
          type: "$type",
          deadline: "$deadline",
          handoutBranchId: { $toString: "$handoutInfo.handoutById" },
        },
      },
    ]);
    if (rows.length === 0) {
      return [];
    }
    // Titles and branch names come from Postgres; a book whose title or branch is gone still shows up.
    const [titles, branchNames] = await Promise.all([
      Item.titlesByIds(rows.map((row) => row.item)),
      Branch.namesByIds(rows.map((row) => row.handoutBranchId)),
    ]);
    const listed = rows
      .map(({ handoutBranchId, ...row }) => {
        const branchName = handoutBranchId === null ? undefined : branchNames.get(handoutBranchId);
        return Object.assign(row, {
          title: titles.get(row.item) ?? "Ukjent bok",
          handoutBranch:
            handoutBranchId !== null && branchName !== undefined
              ? { id: handoutBranchId, name: branchName }
              : null,
        });
      })
      .toSorted(
        (a, b) =>
          new Date(a.deadline).getTime() - new Date(b.deadline).getTime() ||
          a.title.localeCompare(b.title, "nb"),
      );

    // The rules need the full documents, so they are priced after the listing query
    const customerItems = await StorageService.CustomerItems.getMany(rows.map((row) => row.id));
    const actionsById = new Map<string, CustomerItemAction[]>();
    for (const customerItem of customerItems) {
      const branch = await Branch.findOptional(customerItem.handoutInfo?.handoutById);
      actionsById.set(customerItem.id, await buildCustomerItemActions(customerItem, branch));
    }

    return listed.map((row): ActiveCustomerItem =>
      Object.assign(row, { actions: actionsById.get(row.id) ?? [] }),
    );
  }
}
