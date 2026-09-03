import type { HttpContext } from "@adonisjs/core/http";
import { test } from "@japa/runner";
import type sinon from "sinon";
import { createSandbox } from "sinon";

import CustomerItemsController from "#controllers/customer_items_controller";
import { PermissionService } from "#services/permission_service";
import { StorageService } from "#services/storage_service";
import type { CustomerItem } from "#shared/customer-item/customer-item";
import { mock } from "#tests/test-doubles";

const DETAILS_ID = "5f7f7f7f7f7f7f7f7f7f7f7f";

function contextFor(detailsId: string) {
  return mock<HttpContext>({ request: { param: () => detailsId } });
}

/** The $match stage of the aggregate the controller ran. */
function matchStage(aggregateStub: sinon.SinonStub): Record<string, unknown> {
  const pipeline = mock<{ $match?: Record<string, unknown> }[]>(aggregateStub.firstCall.args[0]);
  const stage = pipeline.find((entry) => entry.$match !== undefined)?.$match;
  if (stage === undefined) {
    throw new Error("aggregate had no $match stage");
  }
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

  test("passes the aggregated books through, priced with the customer's own rules", async ({
    assert,
  }) => {
    const book = {
      id: "ci1",
      item: "item1",
      title: "Mønster 1T",
      blid: "abc123",
      type: "rent",
      deadline: new Date("2027-09-01"),
    };
    aggregateStub.resolves([book]);
    sandbox.stub(StorageService, "CustomerItems").value({
      aggregate: aggregateStub,
      getMany: sandbox.stub().resolves([
        mock<CustomerItem>({
          id: "ci1",
          item: "item1",
          deadline: book.deadline,
          orders: [],
          handoutInfo: { handoutBy: "branch", handoutById: "branch1", time: new Date() },
        }),
      ]),
    });
    sandbox.stub(StorageService, "Branches").value({ getOrNull: sandbox.stub().resolves(null) });
    const result = await controller.getActiveCustomerItemsForCustomer(contextFor(DETAILS_ID));
    assert.lengthOf(result, 1);
    assert.include(result[0], book);
    assert.deepEqual(
      result[0]?.actions.map((action) => [action.type, action.available]),
      [
        ["extend", false],
        ["buyout", false],
      ],
    );
  });
});
