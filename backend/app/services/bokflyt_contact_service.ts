import DispatchService from "#services/dispatch_service";

export interface BokflytContactRequest {
  name: string;
  school: string;
  email: string;
  phone: string;
  message?: string;
}

export const BOKFLYT_CONTACT_RECIPIENT = "bokflyt@boklisten.no";

/**
 * A plain-text mail to the sales inbox, so a lead from the Bokflyt page arrives even though no
 * SendGrid template exists for it. Reply-to is the sender, so answering the mail answers the
 * school directly.
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
    replyTo: { email: request.email, name: request.name },
    subject: `Bokflyt: henvendelse fra ${request.school}`,
    text: lines.join("\n"),
  };
}

export const BokflytContactService = {
  async send(request: BokflytContactRequest) {
    await DispatchService.sendPlainEmail({
      ...buildBokflytContactMail(request),
      context: { messageType: "bokflyt-contact" },
    });
  },
};
