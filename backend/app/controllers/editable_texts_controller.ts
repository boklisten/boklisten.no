import type { HttpContext } from "@adonisjs/core/http";

import { PermissionService } from "#services/permission_service";
import { editableTextsValidator } from "#validators/editable_texts_validator";
import EditableText from "#models/editable_text";
import EditableTextTransformer from "#transformers/editable_text_transformer";

export default class EditableTextsController {
  async get({ serialize, params }: HttpContext) {
    return serialize(
      EditableTextTransformer.transform(await EditableText.findOrFail(params["id"])),
    );
  }

  async getAll(ctx: HttpContext) {
    PermissionService.adminOrFail(ctx);
    return ctx.serialize(EditableTextTransformer.transform(await EditableText.all()));
  }

  async upsert(ctx: HttpContext) {
    PermissionService.adminOrFail(ctx);
    const { params, text } = await ctx.request.validateUsing(editableTextsValidator);
    await EditableText.updateOrCreate(params, { text });
  }

  async destroy(ctx: HttpContext) {
    PermissionService.adminOrFail(ctx);
    const editableText = await EditableText.findOrFail(ctx.params["id"]);
    await editableText.delete();
  }
}
