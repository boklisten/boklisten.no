import type { HttpContext } from "@adonisjs/core/http";

import { AuthVippsService } from "#services/auth_vipps_service";

export default class VippsController {
  async redirect({ ally }: HttpContext) {
    await ally.use("vipps").redirect();
  }
  async callback(ctx: HttpContext) {
    await AuthVippsService.handleCallback(ctx);
  }
}
