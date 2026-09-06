import { test } from "@japa/runner";
import type sinon from "sinon";
import { createSandbox } from "sinon";

import { EmployeeMonitoringService } from "#services/employee_monitoring_service";
import { HandoutMonitoring } from "#services/handout_monitoring";

const EMPLOYEE = { detailsId: "5f7f7f7f7f7f7f7f7f7f7f7e", permission: "employee" as const };
const CUSTOMER_ID = "5f7f7f7f7f7f7f7f7f7f7f7f";

test.group("HandoutMonitoring.reportMissingSignature", (group) => {
  let sandbox: sinon.SinonSandbox;
  let report: sinon.SinonStub;

  group.each.setup(() => {
    sandbox = createSandbox();
    report = sandbox.stub(EmployeeMonitoringService, "report").resolves();
  });
  group.each.teardown(() => sandbox.restore());

  test("a handout to a customer without a valid signature is reported with book and reason", async ({
    assert,
  }) => {
    await HandoutMonitoring.reportMissingSignature({
      signatureException: "Aldri signert",
      employee: EMPLOYEE,
      customerId: CUSTOMER_ID,
      title: "Matematikk R1",
      blid: "12345678",
    });

    assert.isTrue(report.calledOnce);
    assert.deepEqual(report.firstCall.args[0], {
      action: "handout-without-signature",
      employee: EMPLOYEE,
      customerId: CUSTOMER_ID,
      details: [
        { label: "Bok", value: "«Matematikk R1»" },
        { label: "Unik ID", value: "12345678" },
        { label: "Grunn", value: "Aldri signert" },
      ],
    });
  });

  test("nothing is reported when the customer's signature is in order", async ({ assert }) => {
    await HandoutMonitoring.reportMissingSignature({
      signatureException: null,
      employee: EMPLOYEE,
      customerId: CUSTOMER_ID,
      title: "Matematikk R1",
      blid: "12345678",
    });

    assert.isFalse(report.called);
  });
});
