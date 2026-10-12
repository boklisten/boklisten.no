import type { HttpContext } from "@adonisjs/core/http";

import { assertNotRoot } from "#services/branch_service";
import { BranchScope } from "#services/branch_scope";
import NotFoundException from "#exceptions/not_found_exception";
import { waitingListCustomerValidator } from "#validators/waiting_list_customer";
import WaitingListCustomer from "#models/waiting_list_customer";
import WaitingListCustomerTransformer from "#transformers/waiting_list_customer_transformer";

export default class WaitingListCustomersController {
  /** The entries at the branches in the caller's scope. */
  async index(ctx: HttpContext) {
    const entries = await WaitingListCustomer.query().whereIn(
      "branchId",
      await BranchScope.homeSubtreeIds(ctx.auth.getUserOrFail()),
    );
    return ctx.serialize(WaitingListCustomerTransformer.transform(entries));
  }

  async store(ctx: HttpContext) {
    const { name, phone, itemId, branchId } = await ctx.request.validateUsing(
      waitingListCustomerValidator,
    );
    await assertNotRoot(branchId);
    await BranchScope.assertSelectableTarget(ctx.auth.getUserOrFail(), branchId);
    await WaitingListCustomer.create({ name, phone, itemId, branchId });
  }

  async destroy(ctx: HttpContext) {
    const waitingListCustomer = await WaitingListCustomer.find(ctx.request.param("id"));
    if (
      !waitingListCustomer ||
      !(await BranchScope.placeInScope(ctx.auth.getUserOrFail(), waitingListCustomer.branchId))
    ) {
      throw new NotFoundException("Fant ikke ventelisteoppføringen");
    }
    await waitingListCustomer.delete();
  }
}
