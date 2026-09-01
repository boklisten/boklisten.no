import type { HttpContext } from "@adonisjs/core/http";

import { PermissionService } from "#services/permission_service";
import { openingHoursValidator } from "#validators/opening_hours";
import OpeningHour from "#models/opening_hour";
import { DateTime } from "luxon";
import OpeningHourTransformer from "#transformers/opening_hour_transformer";

export default class OpeningHoursController {
  async get(ctx: HttpContext) {
    return ctx.serialize(
      OpeningHourTransformer.transform(
        await OpeningHour.query()
          .where("branchId", ctx.request.param("branchId"))
          .where("to", ">", DateTime.now().toSQL())
          .orderBy("to", "asc"),
      ),
    );
  }
  async add(ctx: HttpContext) {
    PermissionService.adminOrFail(ctx);
    const { branchId, from, to } = await ctx.request.validateUsing(openingHoursValidator);
    await OpeningHour.create({
      branchId,
      from: DateTime.fromJSDate(from),
      to: DateTime.fromJSDate(to),
    });
  }
  async delete(ctx: HttpContext) {
    PermissionService.adminOrFail(ctx);
    const openingHour = await OpeningHour.findOrFail(ctx.request.param("id"));
    await openingHour.delete();
  }
}
