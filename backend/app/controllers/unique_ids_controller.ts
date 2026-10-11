import type { HttpContext } from "@adonisjs/core/http";

import BadRequestException from "#exceptions/bad_request_exception";
import BlidService from "#services/blid_service";
import { exportFilename } from "#services/export_filename";
import UniqueIdGeneratorService from "#services/unique_id_generator_service";

export default class UniqueIdsController {
  /** The sticker for one blid as an SVG, drawn from the same layout as the printed labels. */
  async label(ctx: HttpContext) {
    const blid = ctx.request.param("blid");
    if (typeof blid !== "string" || !BlidService.isValidBlid(blid)) {
      throw new BadRequestException("Ugyldig unik ID");
    }
    return { svg: UniqueIdGeneratorService.labelSvg(blid) };
  }

  /** A sheet of fresh stickers for any employee; Merking fetches it and prints it from a hidden iframe. */
  async pdf(ctx: HttpContext) {
    const pdf = await UniqueIdGeneratorService.generateUniqueIdPdf();
    ctx.response
      .header("Content-Type", "application/pdf")
      .header("Content-Length", String(pdf.length))
      .header(
        "Content-Disposition",
        `attachment; filename="${exportFilename("unike-id-er", "pdf")}"`,
      )
      .send(pdf);
  }
}
