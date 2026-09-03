import logger from "@adonisjs/core/services/logger";
import sgMail from "@sendgrid/mail";

import env from "#start/env";
import { EMAIL_SENDER } from "#types/email_templates";

export interface BokflytContactRequest {
  name: string;
  school: string;
  email: string;
  phone: string;
  message?: string;
}

export const BOKFLYT_CONTACT_RECIPIENT = "bokflyt@boklisten.no";

/**
 * A plain-text mail to the sales inbox, so a lead from the Bokflyt page arrives
 * even though no SendGrid template exists for it. Reply-to is the sender, so
 * answering the mail answers the school directly.
 */
export function buildBokflytContactMail(request: BokflytContactRequest) {
  const message = request.message?.trim() ?? "";
  const lines = [
    `Navn: ${request.name}`,
    `Skole: ${request.school}`,
    `E-post: ${request.email}`,
    `Telefon: ${request.phone}`,
    "",
    "Melding:",
    message.length > 0 ? message : "(ingen melding)",
  ];

  return {
    to: BOKFLYT_CONTACT_RECIPIENT,
    from: EMAIL_SENDER.NO_REPLY,
    replyTo: { email: request.email, name: request.name },
    subject: `Bokflyt: henvendelse fra ${request.school}`,
    text: lines.join("\n"),
  };
}

export const BokflytContactService = {
  async send(request: BokflytContactRequest) {
    const mail = buildBokflytContactMail(request);

    if (env.get("API_ENV") !== "production") {
      logger.info(
        { mail },
        "Since API_ENV !== production, the Bokflyt contact request is logged instead of sent",
      );
      return;
    }

    await sgMail.send(mail);
  },
};
