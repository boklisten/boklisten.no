import type { HttpContext } from "@adonisjs/core/http";

import CustomerItem from "#models/customer_item";
import { isObjectIdHex } from "#models/helpers/object_id";
import BookDetailsService from "#services/book_details_service";
import { buildCustomerItemActions, calculateStatus } from "#services/customer_item_actions_service";
import type { ActiveCustomerItem } from "#shared/customer-item/active-customer-item";

export default class CustomerItemsController {
  /** The caller's own books, with the actions they can take on them. */
  async me(ctx: HttpContext) {
    const { id: userId } = ctx.auth.getUserOrFail();
    const customerItems = await CustomerItem.query()
      .where("customer_id", userId)
      .preload("item")
      .preload("handoutBranch")
      .orderBy("updated_at", "desc");
    const ids = customerItems.map(({ id }) => id);
    const [periodLines, invoices] = await Promise.all([
      CustomerItem.lastPeriodLinesOf(ids),
      BookDetailsService.invoiceSummariesOf(ids),
    ]);

    return customerItems.map((customerItem) => {
      const { item, handoutBranch: branch } = customerItem;
      return {
        id: customerItem.id,
        item: {
          id: item.id,
          title: item.title,
          isbn: item.isbnText,
        },
        blid: customerItem.blid,
        type: customerItem.type,
        deadline: customerItem.deadline.toISODate()!,
        handoutAt: customerItem.handedOutAt.toJSDate(),
        branch: {
          id: branch.id,
          name: branch.name,
        },
        status: calculateStatus(customerItem),
        invoice: invoices.get(customerItem.id) ?? null,
        actions: buildCustomerItemActions(
          customerItem,
          branch,
          periodLines.get(customerItem.id)?.periodType ?? undefined,
        ),
      };
    });
  }

  /**
   * The books a given customer is currently holding, for employees working the stand.
   * Separate from `me` because that one is scoped to the caller's own token and leaves out the
   * rental type.
   */
  async forCustomer(ctx: HttpContext) {
    const userId = String(ctx.request.param("userId"));
    if (!isObjectIdHex(userId)) {
      return [];
    }

    const customerItems = await CustomerItem.whereActive(
      CustomerItem.query().where("customer_id", userId),
    )
      .preload("item")
      .preload("handoutBranch");
    const ids = customerItems.map(({ id }) => id);
    const [periodLines, invoices] = await Promise.all([
      CustomerItem.lastPeriodLinesOf(ids),
      BookDetailsService.invoiceSummariesOf(ids),
    ]);
    const listed = customerItems.map((customerItem): ActiveCustomerItem => {
      const { item, handoutBranch: branch } = customerItem;
      return {
        id: customerItem.id,
        item: item.id,
        title: item.title,
        isbn: item.isbnText,
        blid: customerItem.blid,
        type: customerItem.type,
        deadline: customerItem.deadline.toISODate()!,
        handoutBranch: { id: branch.id, name: branch.name },
        invoice: invoices.get(customerItem.id) ?? null,
        actions: buildCustomerItemActions(
          customerItem,
          branch,
          periodLines.get(customerItem.id)?.periodType ?? undefined,
        ),
      };
    });
    return listed.toSorted(
      (a, b) => a.deadline.localeCompare(b.deadline) || a.title.localeCompare(b.title, "nb"),
    );
  }

  /** One of the caller's own books, opened from their book list. */
  async detailsMe(ctx: HttpContext) {
    const details = await BookDetailsService.forCustomerItem(
      String(ctx.request.param("customerItemId")),
      { role: "customer", userId: ctx.auth.getUserOrFail().id },
    );
    return details ?? ctx.response.notFound();
  }

  /** Any customer's book, opened at the stand. */
  async details(ctx: HttpContext) {
    const details = await BookDetailsService.forCustomerItem(
      String(ctx.request.param("customerItemId")),
      { role: "employee" },
    );
    return details ?? ctx.response.notFound();
  }
}
