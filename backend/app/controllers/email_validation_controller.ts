import type { HttpContext } from "@adonisjs/core/http";

import { EmailValidationService } from "#services/email_validation_service";
import { emailValidationValidator } from "#validators/email_validation";

export default class EmailValidationController {
  /** Advisory deliverability check for an address typed into a form; never a reason to reject it. */
  async validate(ctx: HttpContext) {
    const { email, source } = await ctx.request.validateUsing(emailValidationValidator);
    return EmailValidationService.check(email, source);
  }
}
