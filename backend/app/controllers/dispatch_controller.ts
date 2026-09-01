import type { HttpContext } from "@adonisjs/core/http";

import DispatchService from "#services/dispatch_service";
import type { MessageLogContext } from "#services/message_log_service";
import { MessageLogService } from "#services/message_log_service";
import { PermissionService } from "#services/permission_service";
import { EMAIL_TEMPLATES } from "#types/email_templates";
import { createDispatchValidator } from "#validators/dispatch";

export default class DispatchController {
  async getEmailTemplates(ctx: HttpContext) {
    PermissionService.adminOrFail(ctx);
    return (await DispatchService.getEmailTemplates())
      .filter(
        (emailTemplate) =>
          !Object.values(EMAIL_TEMPLATES).some(
            (transactionalTemplate) => transactionalTemplate.templateId === emailTemplate.id,
          ),
      )
      .toSorted((a, b) => a.name.localeCompare(b.name));
  }
  async createDispatch(ctx: HttpContext) {
    const { detailsId } = PermissionService.adminOrFail(ctx);
    const { name, recipients } = await ctx.request.validateUsing(createDispatchValidator);
    const sendout = await MessageLogService.createSendout({
      kind: "custom",
      name: name ?? null,
      initiatedByDetailsId: detailsId,
    });
    const context: MessageLogContext = { messageType: "custom", sendoutId: sendout?.id };
    await Promise.all(
      recipients.map(async (recipient) => {
        if (recipient.email && recipient.emailTemplateId) {
          await DispatchService.sendUserProvidedEmailTemplate({
            templateId: recipient.emailTemplateId,
            recipients: [{ to: recipient.email }],
            context,
          });
        }
        if (recipient.phone && recipient.smsText) {
          await DispatchService.sendUserProvidedSms(recipient.phone, recipient.smsText, context);
        }
      }),
    );
  }
}
