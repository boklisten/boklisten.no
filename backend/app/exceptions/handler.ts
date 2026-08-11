import { HttpContext, ExceptionHandler } from "@adonisjs/core/http";
import app from "@adonisjs/core/services/app";
import * as Sentry from "@sentry/node";

export default class HttpExceptionHandler extends ExceptionHandler {
  protected override debug = !app.inProduction;

  override async report(error: unknown, ctx: HttpContext) {
    if (this.shouldReport(this.toHttpError(error))) {
      Sentry.captureException(error);
    }
    return super.report(error, ctx);
  }
}
