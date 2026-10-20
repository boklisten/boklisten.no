import testUtils from "@adonisjs/core/services/test_utils";
import { test } from "@japa/runner";
import { DateTime } from "luxon";
import type sinon from "sinon";
import { createSandbox } from "sinon";

import BlidsController from "#controllers/blids_controller";
import BranchBooksController from "#controllers/branches/branch_books_controller";
import BranchMembersController from "#controllers/branches/branch_members_controller";
import BranchesController from "#controllers/branches/branches_controller";
import BranchRelationshipsController from "#controllers/branches/branch_relationships_controller";
import BulkCollectionController from "#controllers/bulk_collection_controller";
import CustomerItemsController from "#controllers/customer_items_controller";
import MatchRoundsController from "#controllers/match_rounds_controller";
import MatchesController from "#controllers/matches_controller";
import MessageLogsController from "#controllers/message_logs_controller";
import OpeningHoursController from "#controllers/opening_hours_controller";
import OrdersController from "#controllers/orders_controller";
import SignaturesController from "#controllers/signatures_controller";
import StandCartController from "#controllers/stand_cart_controller";
import UsersController from "#controllers/users_controller";
import WaitingListCustomersController from "#controllers/waiting_list_customers_controller";
import Branch from "#models/branch";
import OpeningHour from "#models/opening_hour";
import User from "#models/user";
import WaitingListCustomer from "#models/waiting_list_customer";
import { LoginService } from "#services/login_service";
import { StandCartLineResolver } from "#services/stand_cart/stand_cart_line_resolver";
import { createMiniatureTree } from "#tests/branch_fixtures";
import { createCustomerItem } from "#tests/customer_item_fixtures";
import { contextFor, rejectionStatus } from "#tests/fixtures";
import { createItem } from "#tests/item_fixtures";
import { createTestRound } from "#tests/matches/match-testing-utils";
import { createOrder } from "#tests/order_fixtures";
import { unchecked } from "#tests/test-doubles";
import { createUniqueItem } from "#tests/unique_item_fixtures";
import { createUser, userDouble } from "#tests/user_fixtures";

test.group("Scope on the branch endpoints", (group) => {
  let sandbox: sinon.SinonSandbox;
  group.each.setup(() => testUtils.db().truncate());
  group.each.setup(() => {
    sandbox = createSandbox();
    sandbox.stub(LoginService, "trackActivity").resolves();
  });
  group.each.teardown(() => sandbox.restore());

  test("GET /branches returns the viewer's slice with the selectable flag", async ({ assert }) => {
    const { root, company, vgs, ullern, ullernVg1 } = await createMiniatureTree();
    const manager = userDouble({ permission: "manager", employeeBranchId: ullern.id });

    const rows = await new BranchesController().index(contextFor(manager));

    assert.deepEqual(
      rows.map((row) => [row.id, row.selectable]),
      [
        [root.id, false],
        [company.id, false],
        [ullern.id, true],
        [ullernVg1.id, true],
        [vgs.id, false],
      ],
    );
  });

  test("GET /branches?include= names a branch outside the slice, not selectable", async ({
    assert,
  }) => {
    const { ullern, nydalen } = await createMiniatureTree();
    const manager = userDouble({ permission: "manager", employeeBranchId: ullern.id });

    const rows = await new BranchesController().index(
      contextFor(manager, { body: { include: nydalen.id } }),
    );

    const included = rows.find((row) => row.id === nydalen.id);
    assert.equal(included?.name, "Nydalen");
    assert.isFalse(included?.selectable);
  });

  test("POST /branches refuses a parent outside the slice with a 400", async ({ assert }) => {
    const { ullern, nydalen } = await createMiniatureTree();
    const manager = userDouble({ permission: "manager", employeeBranchId: ullern.id });
    const body = { name: "Ny klasse", parentBranchId: nydalen.id };

    assert.equal(
      await rejectionStatus(new BranchesController().store(contextFor(manager, { body }))),
      400,
    );
    assert.isNull(await Branch.query().where("name", "Ny klasse").first());
  });

  test("PATCH /branches/relationships passes the current children", async ({ assert }) => {
    const { ullern, ullernVg1 } = await createMiniatureTree();
    const manager = userDouble({ permission: "manager", employeeBranchId: ullern.id });

    await assert.doesNotReject(() =>
      new BranchRelationshipsController().update(
        contextFor(manager, {
          body: {
            id: ullern.id,
            localName: "Ullern vgs",
            childBranchIds: [ullernVg1.id],
          },
        }),
      ),
    );
    assert.equal((await Branch.findOrFail(ullern.id)).localName, "Ullern vgs");
  });

  test("PATCH /branches/:branchId/active_books refuses a move to a branch outside the slice", async ({
    assert,
  }) => {
    const { ullern, ullernVg1, nydalen } = await createMiniatureTree();
    const manager = userDouble({ permission: "manager", employeeBranchId: ullern.id });
    const books = new BranchBooksController();
    const params = { branchId: ullernVg1.id };

    assert.equal(
      await rejectionStatus(
        books.bulkUpdateActiveBooks(
          contextFor(manager, {
            body: {
              filter: { customerItemIds: ["000000000000000000000e01"] },
              update: { branchId: nydalen.id },
            },
            params,
          }),
        ),
      ),
      400,
    );
    assert.equal(
      await rejectionStatus(
        books.bulkUpdateOrderedBooks(
          contextFor(manager, {
            body: {
              filter: { orderItemIds: ["000000000000000000000e01"] },
              update: { branchId: nydalen.id },
            },
            params,
          }),
        ),
      ),
      400,
    );
  });

  test("PATCH /branches/relationships refuses a branch or child outside the slice", async ({
    assert,
  }) => {
    const { ullern, vgs, nydalen } = await createMiniatureTree();
    const manager = userDouble({ permission: "manager", employeeBranchId: ullern.id });
    const controller = new BranchRelationshipsController();

    assert.equal(
      await rejectionStatus(
        controller.update(contextFor(manager, { body: { id: nydalen.id, localName: "N" } })),
      ),
      404,
    );
    assert.equal(
      await rejectionStatus(
        controller.update(
          contextFor(manager, { body: { id: ullern.id, childBranchIds: [nydalen.id] } }),
        ),
      ),
      400,
    );
    assert.equal((await Branch.findOrFail(nydalen.id)).parentBranchId, vgs.id);
  });
});

test.group("Scope on the user lists", (group) => {
  group.each.setup(() => testUtils.db().truncate());

  test("a node outside the slice is a 404 on metrics and employees, inside it answers", async ({
    assert,
  }) => {
    const { ullern, ullernVg1, nydalen } = await createMiniatureTree();
    const manager = userDouble({ permission: "manager", employeeBranchId: ullern.id });
    const controller = new UsersController();

    assert.equal(
      await rejectionStatus(
        controller.metrics(contextFor(manager, { body: { branchId: nydalen.id } })),
      ),
      404,
    );
    assert.equal(
      await rejectionStatus(
        controller.employees(contextFor(manager, { body: { branchId: nydalen.id } })),
      ),
      404,
    );
    await assert.doesNotReject(() =>
      controller.employees(contextFor(manager, { body: { branchId: ullernVg1.id } })),
    );
  });
});

test.group("Scope on match rounds", (group) => {
  group.each.setup(() => testUtils.db().truncate());

  test("rounds are reached by their branch: 404 outside the slice, 400 for a new one there", async ({
    assert,
  }) => {
    const { ullern, nydalen } = await createMiniatureTree();
    const manager = userDouble({ permission: "manager", employeeBranchId: ullern.id });
    const elsewhere = await createTestRound({ branchId: nydalen.id });
    const controller = new MatchRoundsController();

    assert.equal(
      await rejectionStatus(
        controller.index(contextFor(manager, { body: { branchId: nydalen.id } })),
      ),
      404,
    );
    assert.equal(
      await rejectionStatus(
        controller.planMetrics(contextFor(manager, { params: { id: String(elsewhere.id) } })),
      ),
      404,
    );
    assert.equal(
      await rejectionStatus(
        controller.store(
          contextFor(manager, {
            body: {
              branchId: nydalen.id,
              name: "Vår",
              deadline: "2027-06-01",
              meetingDate: "2027-06-10",
              standBranchIds: [],
              standCustomerIds: [],
            },
          }),
        ),
      ),
      400,
    );
  });
});

test.group("Scope on places", (group) => {
  group.each.setup(() => testUtils.db().truncate());

  test("a waiting-list entry at a branch outside the slice is a 400", async ({ assert }) => {
    const { ullern, nydalen } = await createMiniatureTree();
    const manager = userDouble({ permission: "manager", employeeBranchId: ullern.id });
    const item = await createItem();
    const body = { name: "Kari", phone: "90000001", itemId: item.id, branchId: nydalen.id };

    assert.equal(
      await rejectionStatus(
        new WaitingListCustomersController().store(contextFor(manager, { body })),
      ),
      400,
    );
    assert.lengthOf(await WaitingListCustomer.all(), 0);
  });

  test("opening hours follow their branch: 400 to post elsewhere, 404 to delete there", async ({
    assert,
  }) => {
    const { ullern, nydalen } = await createMiniatureTree();
    const manager = userDouble({ permission: "manager", employeeBranchId: ullern.id });
    const controller = new OpeningHoursController();
    const opensAt = DateTime.now().plus({ days: 1 });
    const hour = await OpeningHour.create({
      branchId: nydalen.id,
      opensAt,
      closesAt: opensAt.plus({ hours: 2 }),
    });
    const body = {
      branchId: nydalen.id,
      opensAt: opensAt.toJSDate(),
      closesAt: opensAt.plus({ hours: 2 }).toJSDate(),
    };

    assert.equal(await rejectionStatus(controller.store(contextFor(manager, { body }))), 400);
    assert.equal(
      await rejectionStatus(
        controller.destroy(contextFor(manager, { params: { id: String(hour.id) } })),
      ),
      404,
    );
    assert.isNotNull(await OpeningHour.find(hour.id));
  });
});

test.group("Scope on customers (people-anchored endpoints)", (group) => {
  let sandbox: sinon.SinonSandbox;
  group.each.setup(() => testUtils.db().truncate());
  group.each.setup(() => {
    sandbox = createSandbox();
  });
  group.each.teardown(() => sandbox.restore());

  test("a customer outside the scope is unknown: null on show, 404 on everything else", async ({
    assert,
  }) => {
    const { ullern, ullernVg1, nydalen } = await createMiniatureTree();
    const manager = userDouble({ permission: "manager", employeeBranchId: ullern.id });
    const pupil = await createUser({ branchMembershipId: ullernVg1.id });
    const privatist = await createUser();
    await createOrder({ branchId: ullernVg1.id, customerId: privatist.id });
    const elsewhere = await createUser({ branchMembershipId: nydalen.id });
    const users = new UsersController();
    const forUser = (userId: string) => contextFor(manager, { params: { userId } });

    assert.equal((await users.show(forUser(pupil.id)))?.id, pupil.id);
    assert.equal((await users.show(forUser(privatist.id)))?.id, privatist.id);
    assert.isNull(await users.show(forUser(elsewhere.id)));
    assert.equal(await rejectionStatus(users.confirmEmail(forUser(elsewhere.id))), 404);
    assert.equal(
      await rejectionStatus(new CustomerItemsController().forCustomer(forUser(elsewhere.id))),
      404,
    );
    assert.equal(
      await rejectionStatus(new OrdersController().forCustomer(forUser(elsewhere.id))),
      404,
    );
    assert.equal(
      await rejectionStatus(new OrdersController().placedForCustomer(forUser(elsewhere.id))),
      404,
    );
    assert.equal(
      await rejectionStatus(new MatchesController().forCustomer(forUser(elsewhere.id))),
      404,
    );
    assert.equal(
      await rejectionStatus(new MessageLogsController().forCustomer(forUser(elsewhere.id))),
      404,
    );
    assert.equal(
      await rejectionStatus(new SignaturesController().show(forUser(elsewhere.id))),
      404,
    );
    assert.equal(
      await rejectionStatus(new SignaturesController().link(forUser(elsewhere.id))),
      404,
    );
    assert.equal(
      await rejectionStatus(new SignaturesController().sendLink(forUser(elsewhere.id))),
      404,
    );
  });

  test("merging is for customers in scope only", async ({ assert }) => {
    const { ullern, ullernVg1, nydalen } = await createMiniatureTree();
    const manager = userDouble({ permission: "manager", employeeBranchId: ullern.id });
    const pupil = await createUser({ branchMembershipId: ullernVg1.id });
    const elsewhere = await createUser({ branchMembershipId: nydalen.id });
    const users = new UsersController();

    assert.equal(
      await rejectionStatus(
        users.mergePreview(
          contextFor(manager, { params: { fromUserId: elsewhere.id, toUserId: pupil.id } }),
        ),
      ),
      404,
    );
    assert.equal(
      await rejectionStatus(
        users.merge(
          contextFor(manager, { body: { fromUserId: pupil.id, toUserId: elsewhere.id } }),
        ),
      ),
      404,
    );
    assert.isNotNull(await User.find(elsewhere.id));
  });

  test("a member move needs the moved customer in scope, not only the target", async ({
    assert,
  }) => {
    const { ullern, ullernVg1, nydalen } = await createMiniatureTree();
    const manager = userDouble({ permission: "manager", employeeBranchId: ullern.id });
    const elsewhere = await createUser({ branchMembershipId: nydalen.id });

    assert.equal(
      await rejectionStatus(
        new BranchMembersController().update(
          contextFor(manager, { body: { userId: elsewhere.id, branchMembership: ullernVg1.id } }),
        ),
      ),
      404,
    );
    assert.equal((await User.findOrFail(elsewhere.id)).branchMembershipId, nydalen.id);
  });

  test("the search only finds customers in scope", async ({ assert }) => {
    const { ullern, ullernVg1, nydalen } = await createMiniatureTree();
    const manager = userDouble({ permission: "manager", employeeBranchId: ullern.id });
    const pupil = await createUser({ name: "Kari Nordmann", branchMembershipId: ullernVg1.id });
    await createUser({ name: "Kari Nordmann", branchMembershipId: nydalen.id });

    const hits = await new UsersController().search(
      contextFor(manager, { body: { q: "nordmann" } }),
    );

    assert.deepEqual(
      hits.map((hit) => hit.id),
      [pupil.id],
    );
  });

  test("the stand refuses a customer outside the scope before resolving anything", async ({
    assert,
  }) => {
    const { ullern, ullernVg1, nydalen } = await createMiniatureTree();
    const manager = userDouble({ permission: "manager", employeeBranchId: ullern.id });
    const elsewhere = await createUser({ branchMembershipId: nydalen.id });
    const resolve = sandbox.stub(StandCartLineResolver, "resolve").resolves(unchecked({}));
    const body = { customerId: elsewhere.id, branchId: ullernVg1.id, blid: "10000001" };

    assert.equal(
      await rejectionStatus(new StandCartController().resolveLine(contextFor(manager, { body }))),
      404,
    );
    assert.isFalse(resolve.called);
  });
});

test.group("Scope on places (place-anchored endpoints)", (group) => {
  group.each.setup(() => testUtils.db().truncate());

  test("the order list is bounded by the subtree and a filter never widens it", async ({
    assert,
  }) => {
    const { ullern, ullernVg1, nydalen } = await createMiniatureTree();
    const manager = userDouble({ permission: "manager", employeeBranchId: ullern.id });
    const customer = await createUser();
    const stranger = await createUser({ branchMembershipId: nydalen.id });
    const item = await createItem();
    const ours = await createOrder({
      branchId: ullernVg1.id,
      customerId: customer.id,
      orderItems: [{ itemId: item.id }],
    });
    // A stranger's order elsewhere; an in-scope customer's order elsewhere would be reachable.
    const theirs = await createOrder({
      branchId: nydalen.id,
      customerId: stranger.id,
      orderItems: [{ itemId: item.id }],
    });
    const orders = new OrdersController();

    const all = await orders.index(contextFor(manager, { body: { limit: 50 } }));
    assert.deepEqual(
      all.rows.map((row) => row.id),
      [ours.id],
    );
    const filtered = await orders.index(
      contextFor(manager, { body: { branchIds: [nydalen.id], limit: 50 } }),
    );
    assert.deepEqual(filtered.rows, []);
    assert.isNull(await orders.show(contextFor(manager, { params: { orderId: theirs.id } })));
    assert.equal(
      (await orders.show(contextFor(manager, { params: { orderId: ours.id } })))?.order.id,
      ours.id,
    );
  });

  test("a blid follows its holder and its history: a stranger's book elsewhere is unknown, an in-scope customer's is not", async ({
    assert,
  }) => {
    const { ullern, ullernVg1, nydalen } = await createMiniatureTree();
    const manager = userDouble({ permission: "manager", employeeBranchId: ullern.id });
    const item = await createItem();
    const pupil = await createUser({ branchMembershipId: ullernVg1.id });
    const stranger = await createUser({ branchMembershipId: nydalen.id });
    const book = (customerId: string, handoutBranchId: string, blid: string, returned = false) =>
      createCustomerItem({ itemId: item.id, customerId, handoutBranchId, blid, returned });
    await book(pupil.id, ullernVg1.id, "12340001");
    await book(stranger.id, nydalen.id, "12340002");
    await createUniqueItem({ itemId: item.id, blid: "12340003" });
    await book(pupil.id, nydalen.id, "12340004");
    await book(pupil.id, ullernVg1.id, "12340005", true);
    await book(stranger.id, nydalen.id, "12340005");
    const blids = new BlidsController();
    const show = async (blid: string) =>
      (await blids.show(contextFor(manager, { params: { blid } }))).registered;

    assert.isTrue(await show("12340001"), "handed out in the subtree");
    assert.isFalse(await show("12340002"), "a stranger's book handed out elsewhere");
    assert.isTrue(await show("12340003"), "nobody holds it");
    assert.isTrue(await show("12340004"), "an in-scope customer's book handed out elsewhere");
    assert.isTrue(await show("12340005"), "history in the subtree, now held elsewhere");
    const hits = await blids.index(contextFor(manager, { body: { q: "1234000" } }));
    assert.sameMembers(
      hits.hits.map((hit) => hit.blid),
      ["12340001", "12340003", "12340004", "12340005"],
    );
    // Innsamling takes back any active book, wherever and to whomever it was handed out: the
    // book is in the employee's hands.
    const bulk = new BulkCollectionController();
    assert.isTrue((await bulk.show(contextFor(manager, { params: { blid: "12340002" } }))).success);
    assert.isTrue((await bulk.show(contextFor(manager, { params: { blid: "12340004" } }))).success);
  });

  test("the waiting list is bounded by the subtree", async ({ assert }) => {
    const { ullern, ullernVg1, nydalen } = await createMiniatureTree();
    const manager = userDouble({ permission: "manager", employeeBranchId: ullern.id });
    const item = await createItem();
    const ours = await WaitingListCustomer.create({
      name: "Kari",
      phone: "90000001",
      itemId: item.id,
      branchId: ullernVg1.id,
    });
    const theirs = await WaitingListCustomer.create({
      name: "Ola",
      phone: "90000002",
      itemId: item.id,
      branchId: nydalen.id,
    });
    const waitingList = new WaitingListCustomersController();

    const rows = await waitingList.index(contextFor(manager));
    assert.deepEqual(
      rows.map((row) => row.id),
      [String(ours.id)],
    );
    assert.equal(
      await rejectionStatus(
        waitingList.destroy(contextFor(manager, { params: { id: String(theirs.id) } })),
      ),
      404,
    );
    assert.isNotNull(await WaitingListCustomer.find(theirs.id));
  });
});
