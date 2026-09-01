import string from "@adonisjs/core/helpers/string";
import type { HttpContext } from "@adonisjs/core/http";
import encryption from "@adonisjs/core/services/encryption";

import UnauthorizedException from "#exceptions/unauthorized_exception";
import { PermissionService } from "#services/permission_service";
import UniqueIdGeneratorService from "#services/unique_id_generator_service";

const tokenPurpose = "unique_id_generation";
export default class UniqueIdsController {
  async getToken(ctx: HttpContext) {
    PermissionService.authenticate(ctx, "admin");
    return encryption.encrypt(string.random(32), "1 day", tokenPurpose);
  }

  async downloadUniqueIdPdf(ctx: HttpContext) {
    if (!encryption.decrypt(ctx.request.param("token"), tokenPurpose)) {
      throw new UnauthorizedException("Invalid token");
    }

    const pdf = await UniqueIdGeneratorService.generateUniqueIdPdf();
    ctx.response
      .header("Content-Type", "application/pdf")
      .header("Content-Length", String(pdf.length))
      .header("Content-Disposition", 'attachment; filename="unique-ids.pdf"')
      .send(pdf);
  }
}
