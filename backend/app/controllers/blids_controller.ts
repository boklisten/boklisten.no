import type { HttpContext } from "@adonisjs/core/http";

import BadRequestException from "#exceptions/bad_request_exception";
import { BlidRegistrationService } from "#services/blid_registration_service";
import { BlidSearchService } from "#services/blid_search_service";
import BlidService from "#services/blid_service";
import { UniqueItemEditService } from "#services/unique_item_edit_service";
import type { BlidRegistrationResponse, LinkedBook } from "#shared/blid_registration";
import { blidRegistrationValidator } from "#validators/blid_registration";
import {
  blidActiveItemUpdateValidator,
  blidRelinkValidator,
  blidSearchQueryValidator,
} from "#validators/blid_search";
import { uniqueItemsValidator } from "#validators/unique_item";

function validBlidParameter(ctx: HttpContext): string {
  const blid = ctx.request.param("blid");
  if (typeof blid !== "string" || !BlidService.isValidBlid(blid)) {
    throw new BadRequestException("Ugyldig unik ID");
  }
  return blid;
}

/** Unique IDs (blids): the Boksøk lookups and edits, and the Merking registration flow. */
export default class BlidsController {
  /** Books whose blid contains the typed text, for the admin search field. */
  async index(ctx: HttpContext) {
    const { q } = await ctx.request.validateUsing(blidSearchQueryValidator);
    return BlidSearchService.search(q);
  }

  async show(ctx: HttpContext) {
    return BlidSearchService.lookup(ctx.request.param("blid"));
  }

  async updateActiveItem(ctx: HttpContext) {
    const { customerItemId, deadline, branchId } = await ctx.request.validateUsing(
      blidActiveItemUpdateValidator,
    );
    if (!deadline && !branchId) {
      return ctx.response.badRequest();
    }
    await BlidSearchService.updateActiveItem({ customerItemId, deadline, branchId }, ctx.authUser);
    return ctx.response.noContent();
  }

  /** Points the blid, and the customer items carrying it, at another book. */
  async relink(ctx: HttpContext) {
    const { itemId } = await ctx.request.validateUsing(blidRelinkValidator);
    await UniqueItemEditService.relink({ blid: ctx.request.param("blid"), itemId }, ctx.authUser);
    return ctx.response.noContent();
  }

  /** Deletes the blid; refused while a customer holds the book. */
  async destroy(ctx: HttpContext) {
    await UniqueItemEditService.remove({ blid: ctx.request.param("blid") }, ctx.authUser);
    return ctx.response.noContent();
  }

  /** Which book a blid is already linked to, or null. */
  async showLink(ctx: HttpContext): Promise<LinkedBook | null> {
    return BlidRegistrationService.lookupLink(validBlidParameter(ctx));
  }

  /** The Merking page: link a batch of unique IDs to a book by ISBN. */
  async register(ctx: HttpContext): Promise<BlidRegistrationResponse> {
    const { isbn, blids } = await ctx.request.validateUsing(blidRegistrationValidator);
    return BlidRegistrationService.register(isbn, blids);
  }

  /**
   * Links one blid to a book, for the handout flow where an unlinked sticker turns up. A blid
   * already linked to that very book is fine; the handout carries on.
   */
  async registerOne(ctx: HttpContext): Promise<{ feedback: string }> {
    const { blid, isbn } = await ctx.request.validateUsing(uniqueItemsValidator);

    const result = await BlidRegistrationService.register(isbn, [blid]);
    if (result.success) {
      return { feedback: "" };
    }
    const [conflict] = result.conflicts;
    return {
      feedback: conflict
        ? `Unik ID ${blid} er allerede koblet til «${conflict.linkedTo.title}».`
        : result.feedback,
    };
  }
}
