import type { HttpContext } from "@adonisjs/core/http";

import EmailVerification from "#models/email_verification";
import User from "#models/user";
import DispatchService from "#services/dispatch_service";

export default class EmailVerificationController {
  async send(ctx: HttpContext) {
    const { detailsId } = ctx.authUser;
    const user = await User.findOrFail(detailsId);
    const emailVerification = await EmailVerification.create({ userDetailId: detailsId });
    await DispatchService.sendEmailVerification(user.email, emailVerification.id);
  }

  async verify(ctx: HttpContext) {
    const emailVerification = await EmailVerification.findOrFail(ctx.request.param("id"));
    const user = await User.findOrFail(emailVerification.userDetailId);
    user.emailConfirmed = true;
    await user.save();
    await emailVerification.delete();
  }
}
