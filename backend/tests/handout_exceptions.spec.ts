import { test } from "@japa/runner";
import type sinon from "sinon";
import { createSandbox } from "sinon";

import { ExceptionReportService } from "#services/exception_report_service";
import { HandoutExceptions } from "#services/handout_exceptions";

const EMPLOYEE_ID = "5f7f7f7f7f7f7f7f7f7f7f7e";
const CUSTOMER_ID = "5f7f7f7f7f7f7f7f7f7f7f7f";

test.group("HandoutExceptions.reportMissingSignature", (group) => {
  let sandbox: sinon.SinonSandbox;
  let report: sinon.SinonStub;

  group.each.setup(() => {
    sandbox = createSandbox();
    report = sandbox.stub(ExceptionReportService, "report").resolves();
  });
  group.each.teardown(() => sandbox.restore());

  test("a handout to a customer without a valid signature is reported with book and reason", async ({
    assert,
  }) => {
    await HandoutExceptions.reportMissingSignature({
      signatureException: "Aldri signert",
      employeeId: EMPLOYEE_ID,
      customerId: CUSTOMER_ID,
      title: "Matematikk R1",
      blid: "12345678",
    });

    assert.isTrue(report.calledOnce);
    assert.deepEqual(report.firstCall.args[0], {
      kind: "handout-without-signature",
      employeeId: EMPLOYEE_ID,
      customerId: CUSTOMER_ID,
      details: [
        { label: "Bok", value: "«Matematikk R1»" },
        { label: "Unik ID", value: "12345678" },
        { label: "Grunn", value: "Aldri signert" },
      ],
    });
  });

  test("nothing is reported when the customer's signature is in order", async ({ assert }) => {
    await HandoutExceptions.reportMissingSignature({
      signatureException: null,
      employeeId: EMPLOYEE_ID,
      customerId: CUSTOMER_ID,
      title: "Matematikk R1",
      blid: "12345678",
    });

    assert.isFalse(report.called);
  });
});
