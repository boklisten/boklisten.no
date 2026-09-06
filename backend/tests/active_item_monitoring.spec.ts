import { test } from "@japa/runner";
import type sinon from "sinon";
import { createSandbox } from "sinon";

import { ActiveItemMonitoring } from "#services/active_item_monitoring";
import { EmployeeMonitoringService } from "#services/employee_monitoring_service";

const EMPLOYEE = { detailsId: "5f7f7f7f7f7f7f7f7f7f7f7e", permission: "employee" as const };
const CUSTOMER_ID = "5f7f7f7f7f7f7f7f7f7f7f7f";

test.group("ActiveItemMonitoring", (group) => {
  let sandbox: sinon.SinonSandbox;
  let report: sinon.SinonStub;

  group.each.setup(() => {
    sandbox = createSandbox();
    report = sandbox.stub(EmployeeMonitoringService, "report").resolves();
  });
  group.each.teardown(() => sandbox.restore());

  test("a changed deadline is reported with both dates in Norwegian time", async ({ assert }) => {
    await ActiveItemMonitoring.reportDeadlineChange({
      employee: EMPLOYEE,
      customerId: CUSTOMER_ID,
      title: "Matematikk R1",
      blid: "12345678",
      previousDeadline: new Date("2026-06-30T22:00:00.000Z"),
      deadline: new Date("2026-12-19T23:00:00.000Z"),
    });

    assert.isTrue(report.calledOnce);
    assert.deepEqual(report.firstCall.args[0], {
      action: "active-item-deadline-changed",
      employee: EMPLOYEE,
      customerId: CUSTOMER_ID,
      details: [
        { label: "Bok", value: "«Matematikk R1»" },
        { label: "Unik ID", value: "12345678" },
        { label: "Gammel frist", value: "01.07.2026" },
        { label: "Ny frist", value: "20.12.2026" },
      ],
    });
  });

  test("a changed branch is reported with both names, falling back when none was recorded", async ({
    assert,
  }) => {
    await ActiveItemMonitoring.reportBranchChange({
      employee: EMPLOYEE,
      customerId: CUSTOMER_ID,
      title: "Matematikk R1",
      blid: "12345678",
      previousBranchName: null,
      branchName: "Ullern VGS",
    });

    assert.isTrue(report.calledOnce);
    assert.deepEqual(report.firstCall.args[0], {
      action: "active-item-branch-changed",
      employee: EMPLOYEE,
      customerId: CUSTOMER_ID,
      details: [
        { label: "Bok", value: "«Matematikk R1»" },
        { label: "Unik ID", value: "12345678" },
        { label: "Gammel filial", value: "Ukjent filial" },
        { label: "Ny filial", value: "Ullern VGS" },
      ],
    });
  });
});
