import type { HttpContext } from "@adonisjs/core/http";

import DispatchService from "#services/dispatch_service";
import { PermissionService } from "#services/permission_service";
import { StorageService } from "#services/storage_service";
import EmailVerification from "#models/email_verification";

export default class EmailVerificationController {
  async send(ctx: HttpContext) {
    const { detailsId } = PermissionService.authenticate(ctx);
    const userDetail = await StorageService.UserDetails.get(detailsId);
    const emailVerification = await EmailVerification.create({ userDetailId: detailsId });
    await DispatchService.sendEmailVerification(userDetail.email, emailVerification.id);
  }

  async verify(ctx: HttpContext) {
    const emailVerification = await EmailVerification.findOrFail(ctx.request.param("id"));
    await StorageService.UserDetails.update(emailVerification.userDetailId, {
      emailConfirmed: true,
    });
    await emailVerification.delete();
  }
}
