import logger from "@adonisjs/core/services/logger";
import sgClient from "@sendgrid/client";
import sgMail from "@sendgrid/mail";
import twilio from "twilio";

import type Delivery from "#models/delivery";
import type Message from "#models/message";
import type Order from "#models/order";
import User from "#models/user";
import { OrderEmailHandler } from "#services/orders/order_email_handler";
import { isUnderage } from "#models/signature";
import { SignatureLinkService } from "#services/signature_link_service";
import { userHasValidSignature } from "#services/signature_helper";
import type { MessageLogContext } from "#services/message_log_service";
import { MessageLogService } from "#services/message_log_service";
import { apiOrigin, isDeployed, clientOrigin } from "#config/app";
import env from "#start/env";
import type { EmailOrder, EmailUser } from "#types/email";
import type { EmailRecipient, EmailTemplate } from "#types/email_templates";
import { EMAIL_SENDER, EMAIL_TEMPLATES } from "#types/email_templates";
import { sendgridEmailTemplatesResponseValidator } from "#validators/dispatch";
import { hasPermissionLevel } from "#shared/user-permission";

const twilioClient = twilio(env.get("TWILIO_SMS_SID"), env.get("TWILIO_SMS_AUTH_TOKEN").release(), {
  autoRetry: true,
  maxRetries: 5,
});

interface PlainEmail {
  to: string;
  subject: string;
  text: string;
  replyTo?: { email: string; name?: string };
  context: MessageLogContext;
}

const SKIPPED_OUTSIDE_PRODUCTION_REASON = "Utenfor produksjon sendes e-post bare til ansatte";

/** Outside production only employees receive real mail; everyone else gets a skipped log row. */
async function mayReceiveOutsideProduction(email: string): Promise<boolean> {
  const user = await User.byEmail(email);
  return user !== null && hasPermissionLevel(user.permission, "employee");
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
  await MessageLogService.recordSendResult(logEntries, result);
  return result.status === "sent";
}

interface SmsMessage {
  to: string;
  body: string;
  customerId?: string | null;
  /** What the message log keeps instead of `body`, for a body carrying a secret. */
  loggedBody?: string;
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
  if (!isDeployed) {
    return undefined;
  }
  return `${apiOrigin}/webhooks/twilio/${messageId}`;
}

const SMS_CONCURRENCY = 10;

const SmsService = {
  async sendOne(message: SmsMessage, context: MessageLogContext) {
    const logEntry = await MessageLogService.logOutgoingMessage({
      channel: "sms",
      recipient: message.to,
      context: {
        ...context,
        customerId: message.customerId ?? context.customerId,
      },
      smsBody: message.loggedBody ?? message.body,
    });

    if (env.get("API_ENV") !== "production") {
      logger.info(
        "Since API_ENV !== production, SMS will only be sent to users with permission 'employee' or above",
      );
      const user = await User.byPhone(message.to);
      if (!user || !hasPermissionLevel(user.permission, "employee")) {
        await MessageLogService.recordSendResult([logEntry], {
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
      await MessageLogService.recordSendResult([logEntry], {
        status: "sent",
        providerMessageId: twilioMessage.sid,
      });
      logger.info(`successfully sent SMS to "${message.to}"`);
      return { successCount: 1, failed: [] };
    } catch (error) {
      await MessageLogService.recordSendResult([logEntry], {
        status: "send-failed",
        reason: String(error),
      });
      logger.error(`failed to send SMS to "${message.to}", reason: ${String(error)}`);
      return { successCount: 0, failed: [message.to] };
    }
  },
  async sendMany(messages: SmsMessage[], context: MessageLogContext) {
    const results = [];
    for (let i = 0; i < messages.length; i += SMS_CONCURRENCY) {
      results.push(
        ...(await Promise.all(
          messages.slice(i, i + SMS_CONCURRENCY).map((message) => this.sendOne(message, context)),
        )),
      );
    }
    return results.reduce(
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

// Validating a sendout checks the template of every recipient; one fetch serves them all.
const TEMPLATE_CACHE_MS = 60_000;
let templateCache: {
  expiresAt: number;
  templates: Promise<{ id: string; name: string }[]>;
} | null = null;

async function fetchEmailTemplates() {
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
}

const EmailService = {
  async getEmailTemplates() {
    if (!templateCache || templateCache.expiresAt < Date.now()) {
      const templates = fetchEmailTemplates();
      templateCache = { expiresAt: Date.now() + TEMPLATE_CACHE_MS, templates };
      templates.catch(() => {
        templateCache = null;
      });
    }
    return templateCache.templates;
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
    const allRecipients = Array.isArray(recipients) ? recipients : [recipients];

    let personalizations = allRecipients;
    if (env.get("API_ENV") !== "production") {
      logger.info(
        "Since API_ENV !== production, emails will only be sent to users with permission 'employee' or above",
      );
      personalizations = [];
      const skipped: EmailRecipient[] = [];
      for (const personalization of allRecipients) {
        if (await mayReceiveOutsideProduction(personalization.to)) {
          personalizations.push(personalization);
        } else {
          skipped.push(personalization);
        }
      }
      await MessageLogService.recordSendResult(await this.logEmails(template, skipped, context), {
        status: "skipped",
        reason: SKIPPED_OUTSIDE_PRODUCTION_REASON,
      });
    }

    const batches: EmailRecipient[][] = [];
    for (let i = 0; i < personalizations.length; i += SENDGRID_BATCH_SIZE) {
      batches.push(personalizations.slice(i, i + SENDGRID_BATCH_SIZE));
    }

    let success = true;
    for (const batch of batches) {
      const logEntries = await this.logEmails(template, batch, context);
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
      await MessageLogService.recordSendResult([logEntry], {
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
  async logEmails(
    template: EmailTemplate,
    recipients: EmailRecipient[],
    context: MessageLogContext,
  ) {
    return MessageLogService.logOutgoingMessages(
      recipients.map((recipient) => {
        const subject = recipient.dynamicTemplateData?.["subject"];
        return {
          channel: "email",
          recipient: recipient.to,
          context: {
            ...context,
            customerId: recipient.customerId ?? context.customerId,
          },
          subject: typeof subject === "string" ? subject : null,
          templateId: template.templateId,
          templateData: recipient.dynamicTemplateData,
        };
      }),
    );
  },
};

/** The first word of the name, or "" when the customer has not given one. */
const GUARDIAN_MESSAGE_NAME_MAX_LENGTH = 40;

/**
 * The pupil's name as a message to their guardian may carry it. The name is the customer's own free
 * text, sent to a number and address they typed in themselves, so anything that reads as a link or
 * a domain is dropped and the length capped: our sender must not relay someone else's message.
 */
export function nameForGuardianMessage(name: string | null): string | null {
  const cleaned = (name ?? "")
    .replaceAll(/(?:https?:\/\/|www\.)\S*/giu, " ")
    .replaceAll(/\S*\.\p{L}{2,}\S*/gu, " ")
    .replaceAll(/\s+/gu, " ")
    .trim();
  if (!cleaned) {
    return null;
  }
  return cleaned.length > GUARDIAN_MESSAGE_NAME_MAX_LENGTH
    ? `${cleaned.slice(0, GUARDIAN_MESSAGE_NAME_MAX_LENGTH - 1).trimEnd()}…`
    : cleaned;
}

function firstName(name: string | null): string {
  return name?.split(" ")[0] ?? "";
}

/** "Hei, Kari." or, without a name, "Hei." */
function greeting(name: string | null): string {
  const first = firstName(name);
  return first === "" ? "Hei." : `Hei, ${first}.`;
}

const DispatchService = {
  async sendReminderSms(
    recipients: { to: string; customerId?: string | null }[],
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
      context: { messageType: "receipt", customerId: emailUser.id },
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
  async sendSignatureLink(customer: User, branchName: string) {
    if (await userHasValidSignature(customer)) {
      return;
    }
    customer.taskSignAgreement = true;
    await customer.save();
    const signingUrl = await SignatureLinkService.urlFor(customer);

    const context: MessageLogContext = {
      messageType: "signature",
      customerId: customer.id,
    };

    if (isUnderage(customer) && customer.guardianEmail) {
      await EmailService.sendEmail({
        template: EMAIL_TEMPLATES.guardianSignature,
        context,
        recipients: {
          to: customer.guardianEmail,
          dynamicTemplateData: {
            guardianSignatureUri: signingUrl,
            customerName: nameForGuardianMessage(customer.name) ?? "",
            guardianName: customer.guardianName ?? "",
            branchName,
          },
        },
      });

      if (customer.guardianPhone) {
        const pupilName = nameForGuardianMessage(customer.name);
        await SmsService.sendOne(
          {
            to: customer.guardianPhone,
            body: `Hei. ${pupilName ?? "Eleven"} skal snart motta bøker fra ${branchName} via Boklisten.no. Siden ${pupilName ?? "eleven"} er under 18 år, krever vi at du som foresatt signerer låneavtalen. Vi har derfor sendt en e-post til ${customer.guardianEmail} med lenke til signering. Ta kontakt på info@boklisten.no om du har spørsmål. Mvh. Boklisten`,
          },
          context,
        );
      }
    } else {
      await EmailService.sendEmail({
        template: EMAIL_TEMPLATES.signature,
        context,
        recipients: {
          to: customer.email,
          dynamicTemplateData: {
            signatureUri: signingUrl,
            name: customer.name,
            branchName,
          },
        },
      });

      if (customer.phone) {
        await SmsService.sendOne(
          {
            to: customer.phone,
            body: `Hei. Du skal snart motta bøker fra ${branchName} via Boklisten.no. Før du kan motta bøkene må du signere vår låneavtale. Vi har derfor sendt en e-post til ${customer.email} med lenke til signering. Ta kontakt på info@boklisten.no om du har spørsmål. Mvh. Boklisten`,
          },
          context,
        );
      }
    }
  },

  async sendDeliveryInformation(customer: User, order: Order, delivery: Delivery) {
    await EmailService.sendEmail({
      template: EMAIL_TEMPLATES.deliveryInformation,
      context: { messageType: "delivery-info", customerId: customer.id },
      recipients: [
        {
          to: customer.email,
          dynamicTemplateData: {
            firstName: firstName(customer.name),
            orderId: order.id,
            orderItems: order.orderItems.map((orderItem) => ({
              title: orderItem.title,
              type: OrderEmailHandler.translateOrderItemType(orderItem.type),
              deadline: orderItem.periodTo?.toFormat("dd/MM/yyyy") ?? "",
            })),
            expectedDeliveryDate: delivery.estimatedDelivery?.toFormat("dd/MM/yyyy") ?? "Ukjent",
            trackingNumber: delivery.trackingNumber,
          },
        },
      ],
    });
  },

  /** The message log keeps `loggedBody`, so employees reading it never see the code. */
  async sendSmsCode({
    phone,
    body,
    loggedBody,
    customerId,
    messageType,
  }: {
    phone: string;
    body: string;
    loggedBody: string;
    customerId: string | null;
    messageType: "login-code" | "phone-verification";
  }) {
    return SmsService.sendOne({ to: phone, body, loggedBody, customerId }, { messageType });
  },

  async sendPhoneChangedNotice(oldPhone: string, customerId: string) {
    return SmsService.sendOne(
      {
        to: oldPhone,
        body: `Mobilnummeret på kontoen din hos Boklisten er endret. Var det ikke deg, kontakt oss på ${EMAIL_SENDER.INFO}.`,
        customerId,
      },
      { messageType: "phone-changed" },
    );
  },

  async sendEmailVerification(email: string, verificationId: string) {
    await EmailService.sendEmail({
      template: EMAIL_TEMPLATES.emailVerification,
      context: { messageType: "email-verification" },
      recipients: [
        {
          to: email,
          dynamicTemplateData: {
            emailVerificationUri: `${clientOrigin}/auth/email/verify/${verificationId}`,
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
    customers: User[];
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
          customerId: customer.id,
          dynamicTemplateData: {
            name: firstName(customer.name),
            username: customer.email,
          },
        })),
      }),
      SmsService.sendMany(
        customers.flatMap((customer) =>
          customer.phone === null
            ? []
            : [
                {
                  to: customer.phone,
                  customerId: customer.id,
                  body: `${greeting(customer.name)} ${smsBody} Mvh Boklisten`,
                },
              ],
        ),
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
  async sendOnboardingMessage({ user, branchName }: { user: User; branchName: string }) {
    const context: MessageLogContext = {
      messageType: "onboarding",
      customerId: user.id,
    };
    const userFirstName = firstName(user.name);
    const emailStatus = await EmailService.sendEmail({
      template: EMAIL_TEMPLATES.onboarding,
      context,
      recipients: {
        to: user.email,
        dynamicTemplateData: {
          firstName: userFirstName,
          branchName,
          loginUri: `${clientOrigin}/auth/login`,
        },
      },
    });
    if (user.phone === null) {
      return { emailStatus, smsStatus: null };
    }
    const smsStatus = await SmsService.sendOne(
      {
        to: user.phone,
        body: `Hei ${userFirstName}, velkommen til ${branchName}! Vi i Boklisten administrerer utlån av bøkene du skal bruke, og før du kan få dem trenger vi at du bekrefter informasjonen din og signerer vår låneavtale på Boklisten.no. Er du under 18 år, må en foresatt signere. Vi har opprettet en konto til deg, og du kan logge inn med Vipps eller med en engangskode på SMS for å komme i gang. Mvh. Boklisten.no`,
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
