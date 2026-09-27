import type { HttpContext } from "@adonisjs/core/http";
import { ObjectId } from "mongodb";

import CustomerItem from "#models/customer_item";
import { buildCustomerItemActions, calculateStatus } from "#services/customer_item_actions_service";
import type { ActiveCustomerItem } from "#shared/customer-item/active-customer-item";

export default class CustomerItemsController {
  /** The caller's own books, with the actions they can take on them. */
  async me(ctx: HttpContext) {
    const { id: detailsId } = ctx.auth.getUserOrFail();
    const customerItems = await CustomerItem.query()
      .where("customer_id", detailsId)
      .preload("item")
      .preload("handoutBranch")
      .orderBy("updated_at", "desc");

    return Promise.all(
      customerItems.map(async (customerItem) => {
        const { item, handoutBranch: branch } = customerItem;
        return {
          id: customerItem.id,
          item: {
            id: item.id,
            title: item.title,
            isbn: String(item.isbn),
          },
          blid: customerItem.blid,
          deadline: customerItem.deadline.toJSDate(),
          handoutAt: customerItem.handedOutAt.toJSDate(),
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

    const customerItems = await CustomerItem.whereActive(
      CustomerItem.query().where("customer_id", detailsId),
    )
      .preload("item")
      .preload("handoutBranch");
    const listed = await Promise.all(
      customerItems.map(async (customerItem): Promise<ActiveCustomerItem> => {
        const { item, handoutBranch: branch } = customerItem;
        return {
          id: customerItem.id,
          item: item.id,
          title: item.title,
          blid: customerItem.blid,
          type: customerItem.type,
          deadline: customerItem.deadline.toJSDate(),
          handoutBranch: { id: branch.id, name: branch.name },
          actions: await buildCustomerItemActions(customerItem, branch),
        };
      }),
    );
    return listed.toSorted(
      (a, b) => a.deadline.getTime() - b.deadline.getTime() || a.title.localeCompare(b.title, "nb"),
    );
  }
}
