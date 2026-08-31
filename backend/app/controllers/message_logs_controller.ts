import type { HttpContext } from "@adonisjs/core/http";

import { MessageLogService } from "#services/message_log_service";
import { PermissionService } from "#services/permission_service";
import { messageLogFeedValidator, messageLogMetricsValidator } from "#validators/message_log";

export default class MessageLogsController {
  /** All messages sent to the customer's current contact info, guardians included. */
  async customerLog(ctx: HttpContext) {
    PermissionService.employeeOrFail(ctx);
    return await MessageLogService.customerLog(ctx.request.param("detailsId"));
  }

  /** Newest slice of the global message log, polled by the live feed. */
  async feed(ctx: HttpContext) {
    PermissionService.employeeOrFail(ctx);
    const { limit, channel, sendoutId, onlyFailures, search } =
      await ctx.request.validateUsing(messageLogFeedValidator);
    return await MessageLogService.feed({
      limit: limit ?? 50,
      channel,
      sendoutId,
      onlyFailures,
      search,
    });
  }

  async metrics(ctx: HttpContext) {
    PermissionService.employeeOrFail(ctx);
    const { days } = await ctx.request.validateUsing(messageLogMetricsValidator);
    return await MessageLogService.metrics(days ?? 30);
  }

  async sendouts(ctx: HttpContext) {
    PermissionService.employeeOrFail(ctx);
    return await MessageLogService.sendoutStats(20);
  }
}
