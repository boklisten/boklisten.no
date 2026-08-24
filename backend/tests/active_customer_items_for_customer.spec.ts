import type { HttpContext } from "@adonisjs/core/http";
import { test } from "@japa/runner";
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
  if (stage === undefined) throw new Error("aggregate had no $match stage");
  return stage;
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

  test("requires employee permission", async ({ assert }) => {
    await controller.getActiveCustomerItemsForCustomer(contextFor(DETAILS_ID));
    assert.equal(employeeStub.calledOnce, true);
  });

  test("returns nothing for an id that is not an object id, without querying", async ({
    assert,
  }) => {
    const result = await controller.getActiveCustomerItemsForCustomer(contextFor("not-an-id"));
    assert.deepEqual(result, []);
    assert.equal(aggregateStub.called, false);
  });

  test("scopes the query to the requested customer", async ({ assert }) => {
    await controller.getActiveCustomerItemsForCustomer(contextFor(DETAILS_ID));
    assert.equal(String(matchStage(aggregateStub)["customer"]), DETAILS_ID);
  });

  test("treats a missing flag as not-set, so books written before the flag existed still count", async ({
    assert,
  }) => {
    // Regression guard: { cancel: false } does not match documents where the field is absent, and
    // hundreds of older customer items omit it. isCustomerItemActive reads absent as falsy.
    await controller.getActiveCustomerItemsForCustomer(contextFor(DETAILS_ID));
    const match = matchStage(aggregateStub);
    for (const flag of ["returned", "buyout", "cancel", "buyback"]) {
      assert.deepEqual(match[flag], { $ne: true }, `${flag} must use $ne: true, not false`);
    }
  });

  test("only counts books actually handed out", async ({ assert }) => {
    await controller.getActiveCustomerItemsForCustomer(contextFor(DETAILS_ID));
    assert.equal(matchStage(aggregateStub)["handout"], true);
  });

  test("passes the aggregated books through", async ({ assert }) => {
    const book = {
      id: "ci1",
      title: "Mønster 1T",
      blid: "abc123",
      type: "rent",
      deadline: new Date("2027-09-01"),
    };
    aggregateStub.resolves([book]);
    const result = await controller.getActiveCustomerItemsForCustomer(contextFor(DETAILS_ID));
    assert.deepEqual(result, [book]);
  });
});
