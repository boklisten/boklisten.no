import logger from "@adonisjs/core/services/logger";
import sgClient from "@sendgrid/client";
import sgMail from "@sendgrid/mail";
import moment from "moment-timezone";
import twilio from "twilio";

import type Message from "#models/message";
import { OrderEmailHandler } from "#services/legacy/order_email_handler";
import { isUnderage } from "#models/signature";
import { userHasValidSignature } from "#services/legacy/signature.helper";
import type { MessageLogContext } from "#services/message_log_service";
import { MessageLogService } from "#services/message_log_service";
import { PermissionService } from "#services/permission_service";
import { StorageService } from "#services/storage_service";
import { UserDetailService } from "#services/user_detail_service";
import { UserService } from "#services/user_service";
import type { DeliveryInfoBring } from "#shared/delivery/delivery-info/delivery-info-bring";
import type { Order } from "#shared/order/order";
import type { UserDetail } from "#shared/user-detail";
import env from "#start/env";
import type { EmailOrder, EmailUser } from "#types/email";
import type { EmailRecipient, EmailTemplate } from "#types/email_templates";
import { EMAIL_SENDER, EMAIL_TEMPLATES } from "#types/email_templates";
import { sendgridEmailTemplatesResponseValidator } from "#validators/dispatch";

const twilioClient = twilio(env.get("TWILIO_SMS_SID"), env.get("TWILIO_SMS_AUTH_TOKEN"), {
  autoRetry: true,
  maxRetries: 5,
});

export interface PlainEmail {
  to: string;
  subject: string;
  text: string;
  replyTo?: { email: string; name?: string };
  context: MessageLogContext;
}

const SKIPPED_OUTSIDE_PRODUCTION_REASON = "Utenfor produksjon sendes e-post bare til ansatte";

/** Outside production only employees receive real mail; everyone else gets a skipped log row. */
async function mayReceiveOutsideProduction(email: string): Promise<boolean> {
  const userDetail = await UserDetailService.getByEmail(email);
  const user = userDetail ? await UserService.getByUserDetailsId(userDetail.id) : null;
  return user !== null && PermissionService.isPermissionEqualOrOver(user.permission, "employee");
}

/**
 * Hands one SendGrid request over and records the outcome on every log row it carried. Returns
 * whether SendGrid accepted it.
 */
async function deliverAndRecord(
  logEntries: (Message | null)[],
  send: () => ReturnType<typeof sgMail.send>,
): Promise<boolean> {
  let result: { status: "sent" | "send-failed"; reason?: string };
  try {
    const [sendGridResponse] = await send();
    const ok = sendGridResponse.statusCode === 202;
    if (!ok) {
      logger.error(`SendGrid send failed with status ${sendGridResponse.statusCode}`);
    }
    result = ok
      ? { status: "sent" }
      : { status: "send-failed", reason: `SendGrid svarte ${sendGridResponse.statusCode}` };
  } catch (error) {
    logger.error(`SendGrid send error: ${String(error)}`);
    result = { status: "send-failed", reason: String(error) };
  }
  for (const logEntry of logEntries) {
    await MessageLogService.recordSendResult(logEntry, result);
  }
  return result.status === "sent";
}

interface SmsMessage {
  to: string;
  body: string;
  regardingCustomerDetailsId?: string | null;
}

/**
 * Twilio can only report delivery to a reachable URL, so status callbacks are attached outside
 * local development. The message log row id rides in the path; Twilio echoes it back on every
 * status change.
 */
function twilioStatusCallback(messageId: string | undefined): string | undefined {
  if (!messageId) {
    return undefined;
  }
  if (env.get("API_ENV") !== "production" && env.get("API_ENV") !== "staging") {
    return undefined;
  }
  return `${env.get("BL_API_URI")}/webhooks/twilio/${messageId}`;
}

const SmsService = {
  async sendOne(message: SmsMessage, context: MessageLogContext) {
    const logEntry = await MessageLogService.logOutgoingMessage({
      channel: "sms",
      recipient: message.to,
      context: {
        ...context,
        regardingCustomerDetailsId:
          message.regardingCustomerDetailsId ?? context.regardingCustomerDetailsId,
      },
      smsBody: message.body,
    });

    if (env.get("API_ENV") !== "production") {
      logger.info(
        "Since API_ENV !== production, SMS will only be sent to users with permission 'employee' or above",
      );
      const userDetail = await UserDetailService.getByPhoneNumber(message.to);
      const user = userDetail ? await UserService.getByUserDetailsId(userDetail.id) : null;
      if (!user || !PermissionService.isPermissionEqualOrOver(user.permission, "employee")) {
        await MessageLogService.recordSendResult(logEntry, {
          status: "skipped",
          reason: "Utenfor produksjon sendes SMS bare til ansatte",
        });
        return { successCount: 1, failed: [] };
      }
    }

    try {
      const twilioMessage = await twilioClient.messages.create({
        body: message.body,
        to: `+47${message.to}`,
        from: "Boklisten",
        statusCallback: twilioStatusCallback(logEntry?.id),
      });
      if (logEntry) {
        logEntry.providerMessageId = twilioMessage.sid;
      }
      await MessageLogService.recordSendResult(logEntry, { status: "sent" });
      logger.info(`successfully sent SMS to "${message.to}"`);
      return { successCount: 1, failed: [] };
    } catch (error) {
      await MessageLogService.recordSendResult(logEntry, {
        status: "send-failed",
        reason: String(error),
      });
      logger.error(`failed to send SMS to "${message.to}", reason: ${String(error)}`);
      return { successCount: 0, failed: [message.to] };
    }
  },
  async sendMany(messages: SmsMessage[], context: MessageLogContext) {
    return (await Promise.all(messages.map((message) => this.sendOne(message, context)))).reduce(
      (acc, next) => ({
        successCount: acc.successCount + next.successCount,
        failed: [...acc.failed, ...next.failed],
      }),
      { successCount: 0, failed: [] },
    );
  },
};

// SendGrid allows a maximum of 1000 personalizations per request
const SENDGRID_BATCH_SIZE = 1000;
const EmailService = {
  async getEmailTemplates() {
    const [, body] = await sgClient.request({
      method: "GET",
      url: "/v3/templates",
      qs: {
        generations: "dynamic",
        page_size: 200,
      },
    });
    const [, data] = await sendgridEmailTemplatesResponseValidator.tryValidate(body);
    return data?.result ?? [];
  },
  async sendEmail({
    template,
    recipients,
    context,
  }: {
    template: EmailTemplate;
    recipients: EmailRecipient | EmailRecipient[];
    context: MessageLogContext;
  }) {
    const _personalizations = Array.isArray(recipients) ? recipients : [recipients];

    let personalizations = _personalizations;
    if (env.get("API_ENV") !== "production") {
      logger.info(
        "Since API_ENV !== production, emails will only be sent to users with permission 'employee' or above",
      );
      personalizations = [];
      const skipped: EmailRecipient[] = [];
      for (const personalization of _personalizations) {
        if (await mayReceiveOutsideProduction(personalization.to)) {
          personalizations.push(personalization);
        } else {
          skipped.push(personalization);
        }
      }
      for (const personalization of skipped) {
        const logEntry = await this.logEmail(template, personalization, context);
        await MessageLogService.recordSendResult(logEntry, {
          status: "skipped",
          reason: SKIPPED_OUTSIDE_PRODUCTION_REASON,
        });
      }
    }

    const batches: EmailRecipient[][] = [];
    for (let i = 0; i < personalizations.length; i += SENDGRID_BATCH_SIZE) {
      batches.push(personalizations.slice(i, i + SENDGRID_BATCH_SIZE));
    }

    let success = true;
    for (const batch of batches) {
      const logEntries: (Message | null)[] = [];
      for (const personalization of batch) {
        logEntries.push(await this.logEmail(template, personalization, context));
      }
      const batchOk = await deliverAndRecord(logEntries, () =>
        sgMail.send({
          from: template.sender,
          templateId: template.templateId,
          personalizations: batch.map((personalization, index) => ({
            to: personalization.to,
            dynamicTemplateData: personalization.dynamicTemplateData,
            customArgs: {
              bl_message_id: logEntries[index]?.id ?? "",
              bl_api_env: env.get("API_ENV"),
            },
          })),
        }),
      );
      success &&= batchOk;
    }

    return { success };
  },
  /**
   * A one-off mail with its subject and body written here rather than in a SendGrid template:
   * notices to Boklisten's own inboxes. Same log row, non-production filter and send result
   * bookkeeping as templated mail, with the body kept on the log row so the log page shows it.
   */
  async sendPlainEmail({ to, subject, text, replyTo, context }: PlainEmail) {
    const logEntry = await MessageLogService.logOutgoingMessage({
      channel: "email",
      recipient: to,
      context,
      subject,
      templateData: { text },
    });

    if (env.get("API_ENV") !== "production" && !(await mayReceiveOutsideProduction(to))) {
      logger.info(
        { to, subject, text },
        "Since API_ENV !== production, the mail is logged, not sent",
      );
      await MessageLogService.recordSendResult(logEntry, {
        status: "skipped",
        reason: SKIPPED_OUTSIDE_PRODUCTION_REASON,
      });
      return { success: true };
    }

    const success = await deliverAndRecord([logEntry], () =>
      sgMail.send({
        from: EMAIL_SENDER.NO_REPLY,
        to,
        subject,
        text,
        ...(replyTo === undefined ? {} : { replyTo }),
        customArgs: {
          bl_message_id: logEntry?.id ?? "",
          bl_api_env: env.get("API_ENV"),
        },
      }),
    );
    return { success };
  },
  async logEmail(template: EmailTemplate, recipient: EmailRecipient, context: MessageLogContext) {
    const subject = recipient.dynamicTemplateData?.["subject"];
    return MessageLogService.logOutgoingMessage({
      channel: "email",
      recipient: recipient.to,
      context: {
        ...context,
        regardingCustomerDetailsId:
          recipient.regardingCustomerDetailsId ?? context.regardingCustomerDetailsId,
      },
      subject: typeof subject === "string" ? subject : null,
      templateId: template.templateId,
      templateData: recipient.dynamicTemplateData,
    });
  },
};

const DispatchService = {
  async sendReminderSms(
    recipients: { to: string; regardingCustomerDetailsId?: string | null }[],
    body: string,
    context: MessageLogContext,
  ) {
    return SmsService.sendMany(
      recipients.map((recipient) => ({ ...recipient, body })),
      context,
    );
  },
  async sendUserProvidedSms(phoneNumber: string, body: string, context: MessageLogContext) {
    return SmsService.sendOne({ to: phoneNumber, body }, context);
  },
  async sendOrderReceipt(emailUser: EmailUser, emailOrder: EmailOrder, paymentNeeded: boolean) {
    await EmailService.sendEmail({
      template: EMAIL_TEMPLATES.receipt,
      context: { messageType: "receipt", regardingCustomerDetailsId: emailUser.id },
      recipients: [
        {
          to: emailUser.email,
          dynamicTemplateData: {
            subject: `Din kvittering fra Boklisten.no #${emailOrder.id}`,
            emailTemplateInput: {
              user: emailUser,
              order: emailOrder,
              userFullName: emailUser.name,
              // fixme: this is not visible since the sendout does not currently show textblocks
            },
            textBlock: paymentNeeded
              ? "Dette er kun en reservasjon, du har ikke betalt enda. Du betaler først når du kommer til oss på stand."
              : undefined,
          },
        },
      ],
    });
  },
  async sendSignatureLink(customerDetail: UserDetail, branchName: string) {
    if (await userHasValidSignature(customerDetail)) {
      return;
    }
    await StorageService.UserDetails.update(customerDetail.id, {
      "tasks.signAgreement": true,
    });

    const context: MessageLogContext = {
      messageType: "signature",
      regardingCustomerDetailsId: customerDetail.id,
    };

    if (isUnderage(customerDetail) && customerDetail.guardian) {
      await EmailService.sendEmail({
        template: EMAIL_TEMPLATES.guardianSignature,
        context,
        recipients: {
          to: customerDetail.guardian.email,
          dynamicTemplateData: {
            guardianSignatureUri: `${env.get("CLIENT_URI")}/signering/${customerDetail.id}`,
            customerName: customerDetail.name,
            guardianName: customerDetail.guardian.name,
            branchName,
          },
        },
      });

      await SmsService.sendOne(
        {
          to: customerDetail.guardian.phone,
          body: `Hei. ${customerDetail.name} skal snart motta bøker fra ${branchName} via Boklisten.no. Siden ${customerDetail.name} er under 18 år, krever vi at du som foresatt signerer låneavtalen. Vi har derfor sendt en e-post til ${customerDetail.guardian.email} med lenke til signering. Ta kontakt på info@boklisten.no om du har spørsmål. Mvh. Boklisten`,
        },
        context,
      );
    } else {
      await EmailService.sendEmail({
        template: EMAIL_TEMPLATES.signature,
        context,
        recipients: {
          to: customerDetail.email,
          dynamicTemplateData: {
            signatureUri: `${env.get("CLIENT_URI")}/signering/${customerDetail.id}`,
            name: customerDetail.name,
            branchName,
          },
        },
      });

      await SmsService.sendOne(
        {
          to: customerDetail.phone,
          body: `Hei. Du skal snart motta bøker fra ${branchName} via Boklisten.no. Før du kan motta bøkene må du signere vår låneavtale. Vi har derfor sendt en e-post til ${customerDetail.email} med lenke til signering. Ta kontakt på info@boklisten.no om du har spørsmål. Mvh. Boklisten`,
        },
        context,
      );
    }
  },

  async sendDeliveryInformation(
    customerDetail: UserDetail,
    order: Order,
    bringDeliveryInfo: DeliveryInfoBring,
  ) {
    await EmailService.sendEmail({
      template: EMAIL_TEMPLATES.deliveryInformation,
      context: { messageType: "delivery-info", regardingCustomerDetailsId: customerDetail.id },
      recipients: [
        {
          to: customerDetail.email,
          dynamicTemplateData: {
            firstName: customerDetail.name.split(" ")[0],
            orderId: order.id,
            orderItems: order.orderItems.map((orderItem) => ({
              title: orderItem.title,
              type: OrderEmailHandler.translateOrderItemType(orderItem.type),
              deadline: orderItem.info?.to
                ? moment(orderItem.info.to)
                    .add(1, "day") // fixme: we need to add one day to get the correct date due to a time zone issue
                    .format("DD/MM/YYYY")
                : "",
            })),
            expectedDeliveryDate: bringDeliveryInfo.estimatedDelivery
              ? moment(bringDeliveryInfo.estimatedDelivery).format("DD/MM/YYYY")
              : "Ukjent",
            trackingNumber: bringDeliveryInfo.trackingNumber,
          },
        },
      ],
    });
  },

  async sendPasswordReset({ id, email, token }: { id: number; email: string; token: string }) {
    return EmailService.sendEmail({
      template: EMAIL_TEMPLATES.passwordReset,
      context: { messageType: "password-reset" },
      recipients: [
        {
          to: email,
          dynamicTemplateData: {
            passwordResetUri: `${env.get("CLIENT_URI")}/auth/reset/${id}?token=${token}`,
          },
        },
      ],
    });
  },

  async sendEmailVerification(email: string, verificationId: string) {
    await EmailService.sendEmail({
      template: EMAIL_TEMPLATES.emailVerification,
      context: { messageType: "email-verification" },
      recipients: [
        {
          to: email,
          dynamicTemplateData: {
            emailVerificationUri: `${env.get("CLIENT_URI")}/auth/email/verify/${verificationId}`,
          },
        },
      ],
    });
  },
  async sendMatchInformation({
    customers,
    smsBody,
    sendoutId,
  }: {
    customers: UserDetail[];
    smsBody: string;
    sendoutId?: number | null;
  }) {
    const context: MessageLogContext = { messageType: "match-notify", sendoutId };
    const [mailStatus, smsStatus] = await Promise.all([
      EmailService.sendEmail({
        template: EMAIL_TEMPLATES.matchNotify,
        context,
        recipients: customers.map((customer) => ({
          to: customer.email,
          regardingCustomerDetailsId: customer.id,
          dynamicTemplateData: {
            name: customer.name.split(" ")[0] ?? customer.name,
            username: customer.email,
          },
        })),
      }),
      SmsService.sendMany(
        customers.map((customer) => ({
          to: customer.phone,
          regardingCustomerDetailsId: customer.id,
          body: `Hei, ${customer.name.split(" ")[0]}. ${smsBody} Mvh Boklisten`,
        })),
        context,
      ),
    ]);
    return { mailStatus, smsStatus };
  },
  async sendUserProvidedEmailTemplate({
    templateId,
    recipients,
    context,
  }: {
    templateId: string;
    recipients: EmailRecipient[];
    context: MessageLogContext;
  }) {
    return EmailService.sendEmail({
      template: {
        sender: EMAIL_SENDER.INFO,
        templateId,
      },
      recipients,
      context,
    });
  },
  async sendOnboardingMessage({
    userDetail,
    branchName,
  }: {
    userDetail: UserDetail;
    branchName: string;
  }) {
    const context: MessageLogContext = {
      messageType: "onboarding",
      regardingCustomerDetailsId: userDetail.id,
    };
    const firstName = userDetail.name.split(" ")[0];
    const emailStatus = await EmailService.sendEmail({
      template: EMAIL_TEMPLATES.onboarding,
      context,
      recipients: {
        to: userDetail.email,
        dynamicTemplateData: {
          firstName,
          branchName,
          loginUri: `${env.get("CLIENT_URI")}/auth/login`,
        },
      },
    });
    const smsStatus = await SmsService.sendOne(
      {
        to: userDetail.phone,
        body: `Hei ${firstName}, velkommen til ${branchName}! Vi i Boklisten administrerer utlån av bøkene du skal bruke, og før du kan få dem trenger vi at du bekrefter informasjonen din og signerer vår låneavtale på Boklisten.no. Er du under 18 år, må en foresatt signere. Vi har opprettet en konto til deg, og du kan logge inn med Vipps eller opprette et passord for å komme i gang. Mvh. Boklisten.no`,
      },
      context,
    );
    return { emailStatus, smsStatus };
  },
  async getEmailTemplates() {
    return EmailService.getEmailTemplates();
  },
  async sendPlainEmail(mail: PlainEmail) {
    return EmailService.sendPlainEmail(mail);
  },
};

export default DispatchService;
