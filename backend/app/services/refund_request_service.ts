import * as Sentry from "@sentry/node";
import { DateTime } from "luxon";

import DispatchService from "#services/dispatch_service";
import { StorageService } from "#services/storage_service";
import { TranslationService } from "#services/translation_service";
import { formatBankAccount } from "#shared/bank_account";
import type { Order } from "#shared/order/order";
import type { UserDetail } from "#shared/user-detail";
import env from "#start/env";

export const REFUND_REQUEST_RECIPIENT = "info@boklisten.no";

export interface RefundRequest {
  order: Order;
  customer: UserDetail;
  employee: UserDetail;
  /** Positive: what the administrator transfers. */
  amount: number;
  /** Eleven digits; null when a Vipps refund failed and the customer was never asked for one. */
  accountNumber: string | null;
  comment: string | null;
  occurredAt: DateTime;
}

const MISSING_ACCOUNT_LINE =
  "ukjent. Den automatiske refusjonen via Vipps feilet, så kunden må kontaktes for kontonummer.";

function accountLine(accountNumber: string | null): string {
  return accountNumber === null ? MISSING_ACCOUNT_LINE : formatBankAccount(accountNumber);
}

/**
 * The plain mail that asks the administrator to transfer a refund. Everything they need is in
 * it, so the transfer can be made from the mail alone.
 */
export function buildRefundRequestMail(request: RefundRequest) {
  const { order, customer, employee, amount, accountNumber, comment } = request;
  const occurredAt = request.occurredAt
    .setZone("Europe/Oslo")
    .setLocale("nb")
    .toFormat("d. MMMM yyyy 'kl.' HH:mm");
  const failed = accountNumber === null ? " (Vipps-refusjon feilet)" : "";

  const lines = [
    "Refusjonsforespørsel fra Boklisten.no",
    "",
    `Beløp: ${amount} kr`,
    `Kontonummer: ${accountLine(accountNumber)}`,
    `Tidspunkt: ${occurredAt}`,
    `Ansatt: ${employee.name} (${employee.email})`,
    "",
    `Kunde: ${customer.name}`,
    `Telefon: ${customer.phone}`,
    `E-post: ${customer.email}`,
    `Kasse: ${env.get("CLIENT_URI")}/admin/kasse?kunde=${customer.id}&visning=ordrehistorikk`,
    "",
    `Ordre: ${order.id}`,
    ...order.orderItems.map(
      (orderItem) =>
        `«${orderItem.title}»: ${TranslationService.translateOrderItemTypePastTense(orderItem.type)}, ${orderItem.amount} kr`,
    ),
  ];
  if (comment !== null && comment.trim() !== "") {
    lines.push("", `Kommentar: ${comment.trim()}`);
  }

  return {
    to: REFUND_REQUEST_RECIPIENT,
    subject: `Refusjon: ${amount} kr til ${customer.name}${failed}`,
    text: lines.join("\n"),
  };
}

export const RefundRequestService = {
  /**
   * Asks the administrator to transfer a refund by hand. Sent for every role, administrators
   * included, since it is a job to do rather than a warning. The order is placed by the time
   * this is called, so a mail that cannot be sent goes to Sentry instead of failing the request.
   */
  async send(input: {
    order: Order;
    employeeDetailsId: string;
    amount: number;
    accountNumber: string | null;
    comment: string | null;
  }): Promise<void> {
    try {
      const [customer, employee] = await Promise.all([
        StorageService.UserDetails.get(input.order.customer),
        StorageService.UserDetails.get(input.employeeDetailsId),
      ]);
      const mail = buildRefundRequestMail({
        ...input,
        customer,
        employee,
        occurredAt: DateTime.now(),
      });
      await DispatchService.sendPlainEmail({
        ...mail,
        context: { messageType: "refund-request", regardingCustomerDetailsId: customer.id },
      });
    } catch (error) {
      Sentry.captureException(error, {
        tags: { messageType: "refund-request" },
        extra: { orderId: input.order.id, employeeDetailsId: input.employeeDetailsId },
      });
    }
  },
};
