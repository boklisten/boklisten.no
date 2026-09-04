import { test } from "@japa/runner";
import { DateTime } from "luxon";
import type sinon from "sinon";
import { createSandbox } from "sinon";

import DispatchService from "#services/dispatch_service";
import {
  buildExceptionReportMail,
  EXCEPTION_REPORT_RECIPIENT,
  ExceptionReportService,
} from "#services/exception_report_service";
import { StorageService } from "#services/storage_service";
import type { UserDetail } from "#shared/user-detail";
import env from "#start/env";
import { mock } from "#tests/test-doubles";

const EMPLOYEE_ID = "5f7f7f7f7f7f7f7f7f7f7f7e";
const CUSTOMER_ID = "5f7f7f7f7f7f7f7f7f7f7f7f";

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

const REPORT = {
  kind: "handout-without-signature" as const,
  employee,
  customer,
  details: [
    { label: "Bok", value: "«Matematikk R1»" },
    { label: "Grunn", value: "Aldri signert" },
  ],
  occurredAt: DateTime.fromISO("2026-09-04T08:05:00Z"),
};

test.group("ExceptionReportService", (group) => {
  let sandbox: sinon.SinonSandbox;

  group.each.setup(() => {
    sandbox = createSandbox();
  });
  group.each.teardown(() => sandbox.restore());

  test("the mail names the exception, the employee, the customer with a kasse link, and the details", ({
    assert,
  }) => {
    const mail = buildExceptionReportMail(REPORT);

    assert.equal(mail.to, EXCEPTION_REPORT_RECIPIENT);
    assert.equal(mail.subject, "Unntaksmelding: Bok delt ut uten gyldig signatur");
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
    const mail = buildExceptionReportMail({ ...REPORT, customer: null });

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

    await ExceptionReportService.report({
      kind: "handout-without-signature",
      employeeId: EMPLOYEE_ID,
      customerId: CUSTOMER_ID,
      details: REPORT.details,
    });

    assert.isTrue(sendPlainEmail.calledOnce);
    const mail = sendPlainEmail.firstCall.args[0];
    assert.equal(mail.to, EXCEPTION_REPORT_RECIPIENT);
    assert.include(mail.text, "Ansatt: Ansatt Ansattsen");
    assert.include(mail.text, "Kunde: Kari Kunde");
    assert.deepEqual(mail.context, {
      messageType: "exception-report",
      regardingCustomerDetailsId: CUSTOMER_ID,
    });
  });

  test("report() fails loudly when the people cannot be looked up", async ({ assert }) => {
    sandbox.stub(StorageService.UserDetails, "get").rejects(new Error("mongo down"));
    const sendPlainEmail = sandbox.stub(DispatchService, "sendPlainEmail");

    await assert.rejects(
      () =>
        ExceptionReportService.report({
          kind: "handout-without-signature",
          employeeId: EMPLOYEE_ID,
          customerId: CUSTOMER_ID,
          details: [],
        }),
      "mongo down",
    );
    assert.isFalse(sendPlainEmail.called);
  });
});
