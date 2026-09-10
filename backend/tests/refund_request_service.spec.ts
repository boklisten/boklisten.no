import * as Sentry from "@sentry/node";
import { test } from "@japa/runner";
import { DateTime } from "luxon";
import type sinon from "sinon";
import { createSandbox } from "sinon";

import DispatchService from "#services/dispatch_service";
import {
  buildRefundRequestMail,
  REFUND_REQUEST_RECIPIENT,
  RefundRequestService,
} from "#services/refund_request_service";
import { StorageService } from "#services/storage_service";
import type { Order } from "#shared/order/order";
import type { UserDetail } from "#shared/user-detail";
import env from "#start/env";
import { mock } from "#tests/test-doubles";

const EMPLOYEE_ID = "5f7f7f7f7f7f7f7f7f7f7f7e";
const CUSTOMER_ID = "5f7f7f7f7f7f7f7f7f7f7f7f";
const ORDER_ID = "5f7f7f7f7f7f7f7f7f7f7f31";

const employee = mock<UserDetail>({
  id: EMPLOYEE_ID,
  name: "Ansatt Ansattsen",
  email: "ansatt@boklisten.no",
});
const customer = mock<UserDetail>({
  id: CUSTOMER_ID,
  name: "Kari Kunde",
  email: "kari@example.com",
  phone: "91234567",
});
const order = mock<Order>({
  id: ORDER_ID,
  customer: CUSTOMER_ID,
  amount: -450,
  orderItems: [
    { type: "cancel", title: "Sinus 1T", amount: -250 },
    { type: "sell", title: "Kosmos SF", amount: -200 },
  ],
});

const REQUEST = {
  order,
  customer,
  employee,
  amount: 450,
  accountNumber: "12345678903",
  comment: "Kunden har byttet skole",
  occurredAt: DateTime.fromISO("2026-09-09T08:05:00Z"),
};

function recordEventsSentToSentry(): string[] {
  const captured: string[] = [];
  Sentry.init({
    dsn: "https://public@o0.ingest.sentry.io/0",
    enabled: true,
    defaultIntegrations: false,
    beforeSend(event) {
      captured.push(event.exception?.values?.[0]?.value ?? "");
      return null;
    },
  });
  return captured;
}

test.group("buildRefundRequestMail", () => {
  test("carries everything the administrator needs to make the transfer", ({ assert }) => {
    const mail = buildRefundRequestMail(REQUEST);

    assert.equal(mail.to, REFUND_REQUEST_RECIPIENT);
    assert.equal(mail.subject, "Refusjon: 450 kr til Kari Kunde");
    assert.include(mail.text, "Refusjonsforespørsel fra Boklisten.no");
    assert.include(mail.text, "Beløp: 450 kr");
    assert.include(mail.text, "Kontonummer: 1234.56.78903");
    assert.include(mail.text, "Tidspunkt: 9. september 2026 kl. 10:05");
    assert.include(mail.text, "Ansatt: Ansatt Ansattsen (ansatt@boklisten.no)");
    assert.include(mail.text, "Kunde: Kari Kunde");
    assert.include(mail.text, "Telefon: 91234567");
    assert.include(mail.text, "E-post: kari@example.com");
    assert.include(
      mail.text,
      `Kasse: ${env.get("CLIENT_URI")}/admin/kasse?kunde=${CUSTOMER_ID}&visning=ordrehistorikk`,
    );
    assert.include(mail.text, "«Sinus 1T»: kansellert, -250 kr");
    assert.include(mail.text, "«Kosmos SF»: solgt, -200 kr");
    assert.include(mail.text, `Ordre: ${ORDER_ID}`);
    assert.include(mail.text, "Kommentar: Kunden har byttet skole");
  });

  test("leaves the comment out when the employee wrote none", ({ assert }) => {
    const mail = buildRefundRequestMail({ ...REQUEST, comment: null });
    assert.notInclude(mail.text, "Kommentar:");
  });

  test("says so when the account number is missing because the Vipps refund failed", ({
    assert,
  }) => {
    const mail = buildRefundRequestMail({ ...REQUEST, accountNumber: null, amount: 200 });
    assert.equal(mail.subject, "Refusjon: 200 kr til Kari Kunde (Vipps-refusjon feilet)");
    assert.include(mail.text, "Beløp: 200 kr");
    assert.include(
      mail.text,
      "Kontonummer: ukjent. Den automatiske refusjonen via Vipps feilet, så kunden må kontaktes for kontonummer.",
    );
  });
});

test.group("RefundRequestService.send", (group) => {
  let sandbox: sinon.SinonSandbox;

  group.each.setup(() => {
    sandbox = createSandbox();
    sandbox
      .stub(StorageService.UserDetails, "get")
      .callsFake((id) => Promise.resolve(id === EMPLOYEE_ID ? employee : customer));
  });
  group.each.teardown(() => sandbox.restore());

  test("resolves the people and sends through the dispatch service for any role", async ({
    assert,
  }) => {
    const sendPlainEmail = sandbox
      .stub(DispatchService, "sendPlainEmail")
      .resolves({ success: true });

    await RefundRequestService.send({
      order,
      employeeDetailsId: EMPLOYEE_ID,
      amount: 450,
      accountNumber: "12345678903",
      comment: "Kunden har byttet skole",
    });

    assert.isTrue(sendPlainEmail.calledOnce);
    const mail = sendPlainEmail.firstCall.args[0];
    assert.equal(mail.to, REFUND_REQUEST_RECIPIENT);
    assert.include(mail.text, "Ansatt: Ansatt Ansattsen");
    assert.include(mail.text, "Kunde: Kari Kunde");
    assert.include(mail.text, "Kontonummer: 1234.56.78903");
    assert.deepEqual(mail.context, {
      messageType: "refund-request",
      regardingCustomerDetailsId: CUSTOMER_ID,
    });
  });

  test("a mail that cannot be sent goes to Sentry instead of failing the order", async ({
    assert,
  }) => {
    const captured = recordEventsSentToSentry();
    sandbox.stub(DispatchService, "sendPlainEmail").rejects(new Error("SendGrid down"));

    await RefundRequestService.send({
      order,
      employeeDetailsId: EMPLOYEE_ID,
      amount: 450,
      accountNumber: "12345678903",
      comment: null,
    });
    await Sentry.flush();

    assert.deepEqual(captured, ["SendGrid down"]);
  });
});
