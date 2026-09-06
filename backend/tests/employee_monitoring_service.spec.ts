import * as Sentry from "@sentry/node";
import { test } from "@japa/runner";
import { DateTime } from "luxon";
import type sinon from "sinon";
import { createSandbox } from "sinon";

import DispatchService from "#services/dispatch_service";
import {
  buildMonitoringMail,
  EMPLOYEE_MONITORING_RECIPIENT,
  EmployeeMonitoringService,
} from "#services/employee_monitoring_service";
import { StorageService } from "#services/storage_service";
import type { UserDetail } from "#shared/user-detail";
import env from "#start/env";
import { mock } from "#tests/test-doubles";

const EMPLOYEE_ID = "5f7f7f7f7f7f7f7f7f7f7f7e";
const CUSTOMER_ID = "5f7f7f7f7f7f7f7f7f7f7f7f";

const EMPLOYEE = { detailsId: EMPLOYEE_ID, permission: "employee" as const };
const ADMIN = { detailsId: EMPLOYEE_ID, permission: "admin" as const };

const employee = mock<UserDetail>({
  id: EMPLOYEE_ID,
  name: "Ansatt Ansattsen",
  email: "ansatt@boklisten.no",
  phone: "90000000",
});
const customer = mock<UserDetail>({
  id: CUSTOMER_ID,
  name: "Kari Kunde",
  email: "kari@example.com",
  phone: "91234567",
});

/**
 * Sentry is never initialised under API_ENV=test, so stand up a throwaway client whose beforeSend
 * records what was forwarded and then drops it.
 */
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

const REPORT = {
  action: "handout-without-signature" as const,
  employee,
  customer,
  details: [
    { label: "Bok", value: "«Matematikk R1»" },
    { label: "Grunn", value: "Aldri signert" },
  ],
  occurredAt: DateTime.fromISO("2026-09-04T08:05:00Z"),
};

test.group("EmployeeMonitoringService", (group) => {
  let sandbox: sinon.SinonSandbox;

  group.each.setup(() => {
    sandbox = createSandbox();
  });
  group.each.teardown(() => sandbox.restore());

  test("the mail names the action, the employee, the customer with a kasse link, and the details", ({
    assert,
  }) => {
    const mail = buildMonitoringMail(REPORT);

    assert.equal(mail.to, EMPLOYEE_MONITORING_RECIPIENT);
    assert.equal(mail.subject, "Ansattvarsel: Bok delt ut uten gyldig signatur");
    assert.include(mail.text, "Ansattvarsel fra Boklisten.no");
    assert.include(mail.text, "Hva: Bok delt ut uten gyldig signatur");
    assert.include(mail.text, "Tidspunkt: 4. september 2026 kl. 10:05");
    assert.include(mail.text, "Ansatt: Ansatt Ansattsen (ansatt@boklisten.no)");
    assert.include(mail.text, "Kunde: Kari Kunde");
    assert.include(mail.text, "Telefon: 91234567");
    assert.include(mail.text, "E-post: kari@example.com");
    assert.include(mail.text, `${env.get("CLIENT_URI")}/admin/kasse?kunde=${CUSTOMER_ID}`);
    assert.include(mail.text, "Bok: «Matematikk R1»");
    assert.include(mail.text, "Grunn: Aldri signert");
  });

  test("a report without a customer leaves the customer section out", ({ assert }) => {
    const mail = buildMonitoringMail({ ...REPORT, customer: null });

    assert.notInclude(mail.text, "Kunde:");
    assert.notInclude(mail.text, "admin/kasse");
  });

  test("report() resolves the people and sends through the dispatch service with the customer as context", async ({
    assert,
  }) => {
    sandbox
      .stub(StorageService.UserDetails, "get")
      .callsFake((id) => Promise.resolve(id === EMPLOYEE_ID ? employee : customer));
    const sendPlainEmail = sandbox
      .stub(DispatchService, "sendPlainEmail")
      .resolves({ success: true });

    await EmployeeMonitoringService.report({
      action: "handout-without-signature",
      employee: EMPLOYEE,
      customerId: CUSTOMER_ID,
      details: REPORT.details,
    });

    assert.isTrue(sendPlainEmail.calledOnce);
    const mail = sendPlainEmail.firstCall.args[0];
    assert.equal(mail.to, EMPLOYEE_MONITORING_RECIPIENT);
    assert.include(mail.text, "Ansatt: Ansatt Ansattsen");
    assert.include(mail.text, "Kunde: Kari Kunde");
    assert.deepEqual(mail.context, {
      messageType: "employee-monitoring",
      regardingCustomerDetailsId: CUSTOMER_ID,
    });
  });

  test("report() does nothing when the employee is an admin", async ({ assert }) => {
    const get = sandbox.stub(StorageService.UserDetails, "get");
    const sendPlainEmail = sandbox.stub(DispatchService, "sendPlainEmail");

    await EmployeeMonitoringService.report({
      action: "order-deleted",
      employee: ADMIN,
      customerId: CUSTOMER_ID,
      details: [],
    });

    assert.isFalse(get.called);
    assert.isFalse(sendPlainEmail.called);
  });

  test("report() sends a failed report to Sentry instead of failing the caller", async ({
    assert,
  }) => {
    sandbox.stub(StorageService.UserDetails, "get").rejects(new Error("mongo down"));
    const sendPlainEmail = sandbox.stub(DispatchService, "sendPlainEmail");
    const captured = recordEventsSentToSentry();

    await EmployeeMonitoringService.report({
      action: "handout-without-signature",
      employee: EMPLOYEE,
      customerId: CUSTOMER_ID,
      details: [],
    });
    await Sentry.flush(2000);
    await Sentry.close();

    assert.isFalse(sendPlainEmail.called);
    assert.deepEqual(captured, ["mongo down"]);
  });
});
