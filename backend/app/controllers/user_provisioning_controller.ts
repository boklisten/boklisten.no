import type { HttpContext } from "@adonisjs/core/http";

import { UserProvisioningService } from "#services/user_provisioning_service";
import { userProvisioningValidator } from "#validators/user_provisioning";

export default class UserProvisioningController {
  async evaluate(ctx: HttpContext) {
    const branchId = ctx.request.param("branchId");
    const { userCandidates } = await ctx.request.validateUsing(userProvisioningValidator);

    return UserProvisioningService.evaluate(branchId, userCandidates);
  }

  async provision(ctx: HttpContext) {
    const branchId = ctx.request.param("branchId");
    const { userCandidates, branchResolutions } =
      await ctx.request.validateUsing(userProvisioningValidator);

    return UserProvisioningService.provision(branchId, userCandidates, branchResolutions);
  }
}
