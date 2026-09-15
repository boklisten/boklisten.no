import type { HttpContext } from "@adonisjs/core/http";

import { waitingListCustomerValidator } from "#validators/waiting_list_customer";
import WaitingListCustomer from "#models/waiting_list_customer";
import WaitingListCustomerTransformer from "#transformers/waiting_list_customer_transformer";

export default class WaitingListCustomersController {
  async index(ctx: HttpContext) {
    return ctx.serialize(WaitingListCustomerTransformer.transform(await WaitingListCustomer.all()));
  }

  async store(ctx: HttpContext) {
    const { name, phoneNumber, itemId, branchId } = await ctx.request.validateUsing(
      waitingListCustomerValidator,
    );
    await WaitingListCustomer.create({ name, phoneNumber, itemId, branchId });
  }

  async destroy(ctx: HttpContext) {
    const waitingListCustomer = await WaitingListCustomer.findOrFail(ctx.request.param("id"));
    await waitingListCustomer.delete();
  }
}
