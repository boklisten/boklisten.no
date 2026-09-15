import type { HttpContext } from "@adonisjs/core/http";

import { BranchSignatureStatusService } from "#services/branch_signature_status_service";

export default class BranchSignatureStatusController {
  async show(ctx: HttpContext) {
    return BranchSignatureStatusService.getStatus(ctx.request.param("branchId"));
  }
}
