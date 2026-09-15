import type { HttpContext } from "@adonisjs/core/http";

import { openingHoursValidator } from "#validators/opening_hours";
import OpeningHour from "#models/opening_hour";
import { DateTime } from "luxon";
import OpeningHourTransformer from "#transformers/opening_hour_transformer";

export default class OpeningHoursController {
  async index(ctx: HttpContext) {
    return ctx.serialize(
      OpeningHourTransformer.transform(
        await OpeningHour.query()
          .where("branchId", ctx.request.param("branchId"))
          .where("to", ">", DateTime.now().toSQL())
          .orderBy("to", "asc"),
      ),
    );
  }
  async store(ctx: HttpContext) {
    const { branchId, from, to } = await ctx.request.validateUsing(openingHoursValidator);
    await OpeningHour.create({
      branchId,
      from: DateTime.fromJSDate(from),
      to: DateTime.fromJSDate(to),
    });
  }
  async destroy(ctx: HttpContext) {
    const openingHour = await OpeningHour.findOrFail(ctx.request.param("id"));
    await openingHour.delete();
  }
}
