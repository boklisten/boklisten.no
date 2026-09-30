import type { HttpContext } from "@adonisjs/core/http";

import { MessageLogService } from "#services/message_log_service";
import {
  messageLogFeedValidator,
  messageLogMetricsValidator,
  messageLogSendoutsValidator,
} from "#validators/message_log";

export default class MessageLogsController {
  /** All messages sent to the customer's current contact info, guardians included. */
  async forCustomer(ctx: HttpContext) {
    return MessageLogService.customerLog(ctx.request.param("userId"));
  }

  /** One page of the global message log, newest first; the live feed polls and scrolls it. */
  async feed(ctx: HttpContext) {
    const { limit, channel, sendoutId, onlyFailures, search, cursor } =
      await ctx.request.validateUsing(messageLogFeedValidator);
    return MessageLogService.feed({
      limit: limit ?? 50,
      channel,
      sendoutId,
      onlyFailures,
      search,
      // An infinite query sends an empty cursor for the first page
      cursor: cursor === "" ? undefined : cursor,
    });
  }

  async metrics(ctx: HttpContext) {
    const { days } = await ctx.request.validateUsing(messageLogMetricsValidator);
    return MessageLogService.metrics(days ?? 30);
  }

  async sendouts(ctx: HttpContext) {
    const { limit } = await ctx.request.validateUsing(messageLogSendoutsValidator);
    return MessageLogService.sendoutStats(limit ?? 20);
  }
}
