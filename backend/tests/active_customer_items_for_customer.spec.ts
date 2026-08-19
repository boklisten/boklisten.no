import type { HttpContext } from "@adonisjs/core/http";
import { test } from "@japa/runner";
import { expect } from "chai";
import sinon, { createSandbox } from "sinon";

import CustomerItemsController from "#controllers/customer_items_controller";
import { PermissionService } from "#services/permission_service";
import { StorageService } from "#services/storage_service";

const DETAILS_ID = "5f7f7f7f7f7f7f7f7f7f7f7f";

function contextFor(detailsId: string) {
  return { request: { param: () => detailsId } } as unknown as HttpContext;
}

/** The $match stage of the aggregate the controller ran. */
function matchStage(aggregateStub: sinon.SinonStub): Record<string, unknown> {
  const pipeline = aggregateStub.firstCall.args[0] as { $match?: Record<string, unknown> }[];
  const stage = pipeline.find((entry) => entry.$match !== undefined)?.$match;
  expect(stage, "aggregate had no $match stage").to.not.equal(undefined);
  return stage as Record<string, unknown>;
}

test.group("CustomerItemsController.getActiveCustomerItemsForCustomer", (group) => {
  let sandbox: sinon.SinonSandbox;
  let aggregateStub: sinon.SinonStub;
  let employeeStub: sinon.SinonStub;
  let controller: CustomerItemsController;

  group.each.setup(() => {
    sandbox = createSandbox();
    aggregateStub = sandbox.stub().resolves([]);
    sandbox.stub(StorageService, "CustomerItems").value({ aggregate: aggregateStub });
    employeeStub = sandbox.stub(PermissionService, "employeeOrFail").returns({
      permission: "employee",
      detailsId: "someone-else",
    });
    controller = new CustomerItemsController();
  });
  group.each.teardown(() => {
    sandbox.restore();
  });

  test("requires employee permission", async () => {
    await controller.getActiveCustomerItemsForCustomer(contextFor(DETAILS_ID));
    expect(employeeStub.calledOnce).to.equal(true);
  });

  test("returns nothing for an id that is not an object id, without querying", async () => {
    const result = await controller.getActiveCustomerItemsForCustomer(contextFor("not-an-id"));
    expect(result).to.deep.equal([]);
    expect(aggregateStub.called).to.equal(false);
  });

  test("scopes the query to the requested customer", async () => {
    await controller.getActiveCustomerItemsForCustomer(contextFor(DETAILS_ID));
    expect(String(matchStage(aggregateStub)["customer"])).to.equal(DETAILS_ID);
  });

  test("treats a missing flag as not-set, so books written before the flag existed still count", async () => {
    // Regression guard: { cancel: false } does not match documents where the field is absent, and
    // hundreds of older customer items omit it. isCustomerItemActive reads absent as falsy.
    await controller.getActiveCustomerItemsForCustomer(contextFor(DETAILS_ID));
    const match = matchStage(aggregateStub);
    for (const flag of ["returned", "buyout", "cancel", "buyback"]) {
      expect(match[flag], `${flag} must use $ne: true, not false`).to.deep.equal({ $ne: true });
    }
  });

  test("only counts books actually handed out", async () => {
    await controller.getActiveCustomerItemsForCustomer(contextFor(DETAILS_ID));
    expect(matchStage(aggregateStub)["handout"]).to.equal(true);
  });

  test("passes the aggregated books through", async () => {
    const book = {
      id: "ci1",
      title: "Mønster 1T",
      blid: "abc123",
      type: "rent",
      deadline: new Date("2027-09-01"),
    };
    aggregateStub.resolves([book]);
    const result = await controller.getActiveCustomerItemsForCustomer(contextFor(DETAILS_ID));
    expect(result).to.deep.equal([book]);
  });
});
