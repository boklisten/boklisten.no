import type { HttpContext } from "@adonisjs/core/http";

import { BranchSignatureStatusService } from "#services/branch_signature_status_service";
import { PermissionService } from "#services/permission_service";

export default class BranchSignatureStatusController {
  async getStatus(ctx: HttpContext) {
    PermissionService.adminOrFail(ctx);
    return BranchSignatureStatusService.getStatus(ctx.request.param("branchId"));
  }
}
