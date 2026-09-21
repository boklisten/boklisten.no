import { test } from "@japa/runner";
import { ObjectId } from "mongodb";
import type { PipelineStage } from "mongoose";
import { createSandbox } from "sinon";
import type sinon from "sinon";

import BadRequestException from "#exceptions/bad_request_exception";
import Branch from "#models/branch";
import Item from "#models/item";
import User from "#models/user";
import {
  bringReportPipeline,
  openOrdersPipeline,
  OrderManagerService,
  ordersReportPipeline,
  toBringReportRow,
} from "#services/order_manager_service";
import type { OpenOrderAggregate } from "#services/order_manager_service";
import { StorageService } from "#services/storage_service";
import { mock, unchecked } from "#tests/test-doubles";
import { userDouble } from "#tests/user_fixtures";

const CUSTOMER_ID = "5f7f7f7f7f7f7f7f7f7f7f01";
const BRANCH_ID = "5f7f7f7f7f7f7f7f7f7f7f11";
const ORDER_ID = "5f7f7f7f7f7f7f7f7f7f7f31";

function stageNames(pipeline: PipelineStage[]): string[] {
  return pipeline.map((stage) => Object.keys(stage)[0] ?? "");
}

function firstMatch(pipeline: PipelineStage[]): Record<string, unknown> {
  const stage = pipeline[0];
  if (!stage || !("$match" in stage)) {
    throw new Error("pipeline does not start with $match");
  }
  return unchecked(stage.$match);
}

function row(index: number, branchId = BRANCH_ID): OpenOrderAggregate {
  return mock<OpenOrderAggregate>({
    id: new ObjectId().toHexString(),
    creationTime: new Date(Date.UTC(2026, 8, 1, 12, 0, index)).toISOString(),
    branchId,
    customerId: CUSTOMER_ID,
    openItems: [],
  });
}

/** Every `$lookup` stage's source collection. */
function lookupSources(pipeline: PipelineStage[]): string[] {
  return pipeline.flatMap((stage) => {
    if (!("$lookup" in stage)) {
      return [];
    }
    const lookup: { from: string } = unchecked(stage.$lookup);
    return [lookup.from];
  });
}

function projection(pipeline: PipelineStage[]): Record<string, unknown> {
  const stage = pipeline.find((candidate) => "$project" in candidate);
  if (!stage || !("$project" in stage)) {
    throw new Error("pipeline has no $project stage");
  }
  return unchecked(stage.$project);
}

test.group("OrderManagerService: open orders pipeline", () => {
  test("only placed orders with a book still owed, newest first", ({ assert }) => {
    const pipeline = openOrdersPipeline({}, 50);
    const match = firstMatch(pipeline);
    assert.equal(match["placed"], true);
    assert.deepEqual(match["orderItems"], {
      $elemMatch: {
        type: { $in: ["rent", "partly-payment", "buy"] },
        handout: { $ne: true },
        delivered: { $ne: true },
        movedToOrder: null,
      },
    });
    assert.notProperty(match, "branch");
    assert.notProperty(match, "$or");
    assert.deepEqual(pipeline[1], { $sort: { creationTime: -1, _id: -1 } });
  });

  test("branch filter matches the given ids as ObjectIds", ({ assert }) => {
    const match = firstMatch(openOrdersPipeline({ branchIds: [BRANCH_ID] }, 50));
    const branch: { $in: ObjectId[] } = unchecked(match["branch"]);
    assert.instanceOf(branch.$in[0], ObjectId);
    assert.equal(branch.$in[0]?.toHexString(), BRANCH_ID);
  });

  test("the page is cut one row past the limit, after the Bring narrowing", ({ assert }) => {
    const plain = openOrdersPipeline({}, 50);
    assert.deepEqual(plain[2], { $limit: 51 });

    const bringOnly = openOrdersPipeline({ bringOnly: true }, 50);
    const names = stageNames(bringOnly);
    assert.deepEqual(names.slice(0, 5), ["$match", "$sort", "$lookup", "$match", "$limit"]);
    assert.deepEqual(bringOnly[3], { $match: { "deliveryInfo.method": "bring" } });
  });

  test("the branch is projected as an id, not joined from the emptied Mongo collection", ({
    assert,
  }) => {
    const pipeline = openOrdersPipeline({}, 50);
    assert.notInclude(lookupSources(pipeline), "branches");
    assert.deepEqual(projection(pipeline)["branchId"], { $toString: "$branch" });
  });

  test("a cursor continues strictly after the row it was made from", ({ assert }) => {
    const cursor = {
      creationTime: new Date("2026-09-01T12:00:00.000Z"),
      id: new ObjectId(ORDER_ID),
    };
    const match = firstMatch(openOrdersPipeline({}, 50, cursor));
    assert.deepEqual(match["$or"], [
      { creationTime: { $lt: cursor.creationTime } },
      { creationTime: cursor.creationTime, _id: { $lt: cursor.id } },
    ]);
  });
});

test.group("OrderManagerService: listing", (group) => {
  let sandbox: sinon.SinonSandbox;
  group.each.setup(() => {
    sandbox = createSandbox();
    sandbox.stub(Branch, "namesByIds").resolves(new Map([[BRANCH_ID, "Ullern VGS"]]));
    return () => sandbox.restore();
  });

  test("branch names are joined from Postgres, a dangling branch reads as unknown", async ({
    assert,
  }) => {
    const dangling = "5f7f7f7f7f7f7f7f7f7f7f99";
    sandbox.stub(StorageService.Orders, "aggregate").resolves([row(1), row(0, dangling)]);

    const page = await OrderManagerService.listOpenOrders({}, undefined, 50);

    assert.deepEqual(page.rows[0]?.branch, { id: BRANCH_ID, name: "Ullern VGS" });
    assert.deepEqual(page.rows[1]?.branch, { id: dangling, name: null });
    assert.notProperty(page.rows[0], "branchId");
  });

  test("a full page carries a cursor made from its last row", async ({ assert }) => {
    const rows = Array.from({ length: 51 }, (_, index) => row(50 - index));
    sandbox.stub(StorageService.Orders, "aggregate").resolves(rows);

    const page = await OrderManagerService.listOpenOrders({}, undefined, 50);

    assert.lengthOf(page.rows, 50);
    const last = rows[49];
    assert.equal(page.nextCursor, `${last?.creationTime}_${last?.id}`);
  });

  test("the last page has no cursor", async ({ assert }) => {
    sandbox.stub(StorageService.Orders, "aggregate").resolves([row(1), row(0)]);

    const page = await OrderManagerService.listOpenOrders({}, undefined, 50);

    assert.lengthOf(page.rows, 2);
    assert.isNull(page.nextCursor);
  });

  test("the cursor round-trips into the next page's match", async ({ assert }) => {
    const aggregate = sandbox.stub(StorageService.Orders, "aggregate").resolves([]);
    const creationTime = "2026-09-01T12:00:05.000Z";

    await OrderManagerService.listOpenOrders({}, `${creationTime}_${ORDER_ID}`, 50);

    const match = firstMatch(unchecked(aggregate.firstCall.args[0]));
    const or: { creationTime: Date | { $lt: Date } }[] = unchecked(match["$or"]);
    assert.deepEqual(or[0]?.creationTime, { $lt: new Date(creationTime) });
  });

  test("a mangled cursor is refused", async ({ assert }) => {
    sandbox.stub(StorageService.Orders, "aggregate").resolves([]);

    await assert.rejects(
      () => OrderManagerService.listOpenOrders({}, "not-a-cursor", 50),
      BadRequestException,
    );
  });
});

test.group("OrderManagerService: reports", () => {
  test("the orders report keeps only the open item after unwinding", ({ assert }) => {
    const pipeline = ordersReportPipeline({});
    const unwindIndex = stageNames(pipeline).indexOf("$unwind");
    assert.deepEqual(pipeline[unwindIndex], { $unwind: "$orderItems" });
    assert.deepEqual(pipeline[unwindIndex + 1], {
      $match: {
        "orderItems.type": { $in: ["rent", "partly-payment", "buy"] },
        "orderItems.handout": { $ne: true },
        "orderItems.delivered": { $ne: true },
        "orderItems.movedToOrder": null,
      },
    });
  });

  test("the orders report joins both branch names in code, keeping the column order", async ({
    assert,
  }) => {
    const pipeline = ordersReportPipeline({});
    assert.notInclude(lookupSources(pipeline), "branches");
    assert.notInclude(lookupSources(pipeline), "userdetails");
    const project = projection(pipeline);
    assert.deepEqual(project["schoolId"], { $toString: "$branch" });
    assert.deepEqual(project["customerId"], { $toString: "$customer" });

    const sandbox = createSandbox();
    try {
      const membershipId = "5f7f7f7f7f7f7f7f7f7f7f22";
      sandbox.stub(Branch, "namesByIds").resolves(
        new Map([
          [BRANCH_ID, "Ullern VGS"],
          [membershipId, "Ullern VG1"],
        ]),
      );
      sandbox.stub(Item, "byIds").resolves(new Map());
      sandbox
        .stub(User, "byIds")
        .resolves(
          new Map([
            [
              CUSTOMER_ID,
              userDouble({ id: CUSTOMER_ID, name: "Kari", branchMembershipId: membershipId }),
            ],
          ]),
        );
      sandbox.stub(StorageService.Orders, "aggregate").resolves([
        {
          customerId: CUSTOMER_ID,
          schoolId: BRANCH_ID,
          title: "Sinus",
          itemId: null,
          orderTime: "2026-09-01T12:00:00.000Z",
          paid: true,
          pivot: 1,
        },
      ]);

      const [report] = await OrderManagerService.ordersReport({});

      assert.deepEqual(Object.keys(report ?? {}), [
        "name",
        "email",
        "phone",
        "address",
        "dob",
        "branchMembership",
        "school",
        "title",
        "isbn",
        "orderTime",
        "paid",
        "pivot",
      ]);
      assert.equal(report?.name, "Kari");
      assert.equal(report?.branchMembership, "Ullern VG1");
      assert.equal(report?.school, "Ullern VGS");
    } finally {
      sandbox.restore();
    }
  });

  test("the Bring report splits on the mailbox product, unknown products go to the pickup file", ({
    assert,
  }) => {
    assert.deepEqual(bringReportPipeline({}, "postkasse")[3], {
      $match: { "deliveryInfo.info.product": "3584" },
    });
    assert.deepEqual(bringReportPipeline({}, "hentested")[3], {
      $match: { "deliveryInfo.info.product": { $ne: "3584" } },
    });
  });

  test("Bring rows carry the Mybring headers for their parcel type", ({ assert }) => {
    const shipment = {
      name: "Kari Nordmann",
      address: "Storgata 1",
      postalCode: "0150",
      phone: "91234567",
      email: "kari@example.com",
    };

    const mailbox = toBringReportRow(shipment, "postkasse");
    assert.deepEqual(Object.keys(mailbox), [
      "Name *",
      "Address line 1 *",
      "Address line 2 *",
      "Postal code *",
      "Contact person",
      "Mobile number *",
      "E-mail *",
      "Sender's reference",
      "Recipient's reference",
      "Bag on Door (yes/no)",
    ]);
    assert.equal(mailbox["Mobile number *"], "+4791234567");
    assert.equal(mailbox["Bag on Door (yes/no)"], "no");

    const pickup = toBringReportRow({ ...shipment, phone: "+4791234567" }, "hentested");
    assert.deepEqual(Object.keys(pickup), [
      "Number of items (per shipment) *",
      "Name *",
      "Address line 1 *",
      "Address line 2 *",
      "Postal code *",
      "Contact person",
      "Mobile number (incl. country code) *",
      "E-mail *",
      "Sender's reference",
      "Recipient's reference",
    ]);
    assert.equal(pickup["Number of items (per shipment) *"], 1);
    assert.equal(pickup["Mobile number (incl. country code) *"], "+4791234567");
  });
});
