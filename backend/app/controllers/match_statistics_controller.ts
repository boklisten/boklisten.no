import type { HttpContext } from "@adonisjs/core/http";

import { computeMatchStatistics } from "#services/matches/statistics";
import { PermissionService } from "#services/permission_service";
import { BlError } from "#shared/bl-error";

export default class MatchStatisticsController {
  async getStatistics(ctx: HttpContext) {
    PermissionService.employeeOrFail(ctx);
    return ctx.serialize(await computeMatchStatistics());
  }

  async getStatisticsForRound(ctx: HttpContext) {
    PermissionService.employeeOrFail(ctx);
    const roundId = Number(ctx.request.param("roundId"));
    if (!Number.isInteger(roundId)) {
      throw new BlError("Ugyldig runde-ID").code(701);
    }
    return ctx.serialize(await computeMatchStatistics(roundId));
  }
}
