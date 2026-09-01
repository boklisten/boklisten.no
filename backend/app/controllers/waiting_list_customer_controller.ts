import type { HttpContext } from "@adonisjs/core/http";

import { PermissionService } from "#services/permission_service";
import { waitingListCustomerValidator } from "#validators/waiting_list_customer";
import WaitingListCustomer from "#models/waiting_list_customer";
import WaitingListCustomerTransformer from "#transformers/waiting_list_customer_transformer";

export default class WaitingListCustomerController {
  async getAll(ctx: HttpContext) {
    PermissionService.employeeOrFail(ctx);
    return ctx.serialize(WaitingListCustomerTransformer.transform(await WaitingListCustomer.all()));
  }

  async create(ctx: HttpContext) {
    PermissionService.employeeOrFail(ctx);
    const { name, phoneNumber, itemId, branchId } = await ctx.request.validateUsing(
      waitingListCustomerValidator,
    );
    await WaitingListCustomer.create({ name, phoneNumber, itemId, branchId });
  }

  async destroy(ctx: HttpContext) {
    PermissionService.employeeOrFail(ctx);
    const waitingListCustomer = await WaitingListCustomer.findOrFail(ctx.request.param("id"));
    await waitingListCustomer.delete();
  }
}
