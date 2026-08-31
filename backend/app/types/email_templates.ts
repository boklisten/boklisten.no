export const EMAIL_SENDER = {
  NO_REPLY: "ikkesvar@boklisten.no",
  INFO: "info@boklisten.no",
} as const satisfies Record<Uppercase<string>, `${Lowercase<string>}@boklisten.no`>;

type AllowedEmailSender = (typeof EMAIL_SENDER)[keyof typeof EMAIL_SENDER];

export interface EmailTemplate {
  sender: AllowedEmailSender;
  templateId: string;
}

export const EMAIL_TEMPLATES = {
  receipt: {
    sender: EMAIL_SENDER.NO_REPLY,
    templateId: "d-dc8ab3365a0f4fd8a69b6a38e6eb83f9",
  },
  emailVerification: {
    sender: EMAIL_SENDER.NO_REPLY,
    templateId: "d-8734d0fdf5fc4d99bf22553c3a0c724a",
  },
  passwordReset: {
    sender: EMAIL_SENDER.NO_REPLY,
    templateId: "d-66e886995d4e46a0adfb133a163952d9",
  },
  guardianSignature: {
    sender: EMAIL_SENDER.NO_REPLY,
    templateId: "d-e0eaab765bae483c95f76a178853de74",
  },
  signature: {
    sender: EMAIL_SENDER.NO_REPLY,
    templateId: "d-2459a4845ea046dea33127449a5b7633",
  },
  deliveryInformation: {
    sender: EMAIL_SENDER.NO_REPLY,
    templateId: "d-6112c8e2a3214f058dae6a3b2bf0775e",
  },
  matchNotify: {
    sender: EMAIL_SENDER.INFO,
    templateId: "d-b6d2e8bcf3bc4e6e9aef3f8eb49f1c64",
  },
  onboarding: {
    sender: EMAIL_SENDER.INFO,
    templateId: "d-a0edd89f0af34e318cb4aa476f07d186",
  },
} as const satisfies Record<string, EmailTemplate>;

export interface EmailRecipient {
  to: string;
  dynamicTemplateData?: Record<string, unknown>;
  /** Message-log context only — stripped before the personalization is sent to SendGrid. */
  regardingCustomerDetailsId?: string | null;
}
