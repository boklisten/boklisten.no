import type { HttpContext } from "@adonisjs/core/http";

import { computeMatchStatistics } from "#services/match_statistics_service";
import { PermissionService } from "#services/permission_service";

export default class MatchStatisticsController {
  async getStatistics(ctx: HttpContext) {
    PermissionService.employeeOrFail(ctx);
    return await computeMatchStatistics();
  }
}
