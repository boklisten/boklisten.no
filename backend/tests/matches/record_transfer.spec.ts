import { test } from "@japa/runner";
import testUtils from "@adonisjs/core/services/test_utils";
import { DateTime } from "luxon";
import type sinon from "sinon";
import { createSandbox } from "sinon";

import BookHandover from "#models/book_handover";
import Match from "#models/match";
import MatchObligation from "#models/match_obligation";
import MatchParticipant from "#models/match_participant";
import type MatchRound from "#models/match_round";
import { createTestRound } from "#tests/matches/match-testing-utils";
import { CustomerItemActiveBlid } from "#services/legacy/collections/customer-item/helpers/customer-item-active-blid";
import { OrderToCustomerItemGenerator } from "#services/legacy/collections/customer-item/helpers/order-to-customer-item-generator";
import { OrderActive } from "#services/legacy/collections/order/helpers/order-active/order-active";
import { OrderItemMovedFromOrderHandler } from "#services/legacy/collections/order/helpers/order-item-moved-from-order-handler/order-item-moved-from-order-handler";
import { OrderValidator } from "#services/legacy/collections/order/helpers/order-validator/order-validator";
import { MatchRepository } from "#services/matches/match_repository";
import { recordTransfer } from "#services/matches/record_transfer";
import { StorageService } from "#services/storage_service";
import type { CustomerItem } from "#shared/customer-item/customer-item";
import { asStub, mock, unchecked } from "#tests/test-doubles";

/** The receiver doing the scanning. */
const A = "5d765db5fc8c47001c408d81";
/** The peer A was matched with. */
const B = "5d765db5fc8c47001c408d82";
/** A third student, in nobody's match with A. */
const C = "5d765db5fc8c47001c408d83";
const ITEM_X = "5d765db5fc8c47001c408e01";
const BRANCH = "5d765db5fc8c47001c408b01";
/** The two GYMNOS editions customers order interchangeably. */
const GYMNOS_2009 = "5b6441c4d2e733002fae89a6";
const GYMNOS_2012 = "5b6441b2d2e733002fae87a6";

const BLID = "BL0001234567";

function inOneMonth(): Date {
  return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
}

/** The minimum of an active `CustomerItem` that the transfer path actually reads. */
function activeCopy(overrides: Partial<CustomerItem> & { customer: string }): CustomerItem {
  return mock<CustomerItem>({
    id: "customer-item-1",
    blid: BLID,
    item: ITEM_X,
    deadline: inOneMonth(),
    handoutInfo: {
      handoutBy: "branch",
      handoutById: BRANCH,
      handoutEmployee: "",
      time: new Date(),
    },
    returned: false,
    ...overrides,
  });
}

test.group("recordTransfer", (group) => {
  let sandbox: sinon.SinonSandbox;
  let round: MatchRound;

  group.each.setup(() => {
    sandbox = createSandbox();
  });
  group.each.teardown(() => sandbox.restore());
  // `truncate()` returns the cleanup hook, so this empties the tables after each test.
  group.each.setup(() => testUtils.db().truncate());
  group.each.setup(async () => {
    // Explicitly active: transfers only discharge obligations in rounds that are switched on.
    round = await createTestRound({ name: "Round", standLocation: "Kantina", status: "active" });
  });

  /**
   * One obligation in its own match. `null` on either side is the stand.
   */
  async function seedObligation(
    senderId: string | null,
    receiverId: string | null,
    itemId: string = ITEM_X,
  ): Promise<MatchObligation> {
    const match = await Match.create({ roundId: round.id, meetingLocation: "Biblioteket" });
    const [sender, receiver] = await MatchParticipant.createMany([
      { matchId: match.id, userDetailId: senderId },
      { matchId: match.id, userDetailId: receiverId },
    ]);
    return MatchObligation.create({
      matchId: match.id,
      senderParticipantId: sender!.id,
      receiverParticipantId: receiver!.id,
      itemId,
    });
  }

  /** Stubs every Mongo-side collaborator; the Postgres side stays real. */
  function stubMongo(customerItem: CustomerItem | null, options: { orderedItem?: string } = {}) {
    sandbox
      .stub(CustomerItemActiveBlid.prototype, "getActiveCustomerItems")
      .resolves(customerItem ? [customerItem] : []);

    sandbox.stub(OrderActive.prototype, "getActiveOrders").resolves(
      unchecked([
        {
          id: "receiver-rent-order",
          branch: BRANCH,
          customer: A,
          placed: true,
          orderItems: [
            {
              type: "rent",
              item: options.orderedItem ?? customerItem?.item ?? ITEM_X,
              title: "Matematikk R1",
              amount: 0,
              unitPrice: 0,
              info: { to: inOneMonth() },
            },
          ],
        },
      ]),
    );

    sandbox
      .stub(StorageService.Items, "get")
      .callsFake(async (id) => unchecked({ id, title: "Matematikk R1" }));
    // Names for the unexpected-sender feedback. Without this stub the lookup hangs on a Mongo
    // connection that does not exist in this suite.
    sandbox
      .stub(StorageService.UserDetails, "getMany")
      .callsFake(async (ids) =>
        unchecked(ids.map((id) => ({ id, name: id === B ? "Bendik Buer" : "Cecilie Carlsen" }))),
      );
    sandbox.stub(StorageService.Branches, "get").resolves(
      unchecked({
        id: BRANCH,
        paymentInfo: { rentPeriods: [{ date: inOneMonth() }] },
      }),
    );

    let placedOrders = 0;
    sandbox
      .stub(StorageService.Orders, "add")
      .callsFake(async (order) => ({ ...order, id: `placed-order-${++placedOrders}` }));
    sandbox.stub(StorageService.Orders, "update").resolvesArg(0);

    sandbox.stub(StorageService.CustomerItems, "update").resolvesArg(0);
    // No other copies of the title, so no deadline is extended.
    sandbox.stub(StorageService.CustomerItems, "aggregate").resolves(unchecked([]));
    sandbox
      .stub(StorageService.CustomerItems, "add")
      .resolves(unchecked({ id: "new-customer-item" }));

    sandbox
      .stub(OrderToCustomerItemGenerator.prototype, "generate")
      .resolves(unchecked([{ id: "generated-customer-item" }]));
    sandbox.stub(OrderValidator.prototype, "validate").resolves();
    return {
      movedHandlerStub: sandbox
        .stub(OrderItemMovedFromOrderHandler.prototype, "updateOrderItems")
        .resolves(),
    };
  }

  test("a peer's own copy discharges both halves with one handover", async ({ assert }) => {
    const obligation = await seedObligation(B, A);
    stubMongo(activeCopy({ customer: B }));

    const { feedback } = await recordTransfer(A, { blid: BLID });

    assert.isUndefined(feedback);
    const handovers = await BookHandover.all();
    assert.lengthOf(handovers, 1);
    assert.equal(handovers[0]!.blid, BLID);
    assert.equal(handovers[0]!.fromUserDetailId, B);
    assert.equal(handovers[0]!.toUserDetailId, A);
    assert.equal(handovers[0]!.dischargesSenderObligationId, obligation.id);
    assert.equal(handovers[0]!.dischargesReceiverObligationId, obligation.id);
  });

  test("a copy owned by a third student credits that student, not the matched peer", async ({
    assert,
  }) => {
    // A is set up with B, but the copy A scans still belongs to C — C never recorded giving it to
    // B, so C is the one who is credited and B stays on the hook for their own copy.
    const mine = await seedObligation(B, A);
    const theirs = await seedObligation(C, B);
    stubMongo(activeCopy({ customer: C }));

    const { feedback } = await recordTransfer(A, { blid: BLID });

    assert.match(feedback ?? "", /Boka du skannet var Cecilie Carlsen sin/);
    assert.match(
      feedback ?? "",
      /Bendik Buer er fortsatt ansvarlig for å levere sin opprinnelige bok/,
    );
    const [handover] = await BookHandover.all();
    assert.equal(handover!.dischargesReceiverObligationId, mine.id);
    assert.equal(handover!.dischargesSenderObligationId, theirs.id);

    const stillOpen = await BookHandover.query().where("dischargesSenderObligationId", mine.id);
    assert.isEmpty(stillOpen, "B's own obligation must stay open");
  });

  test("a copy from a student with no obligation satisfies the receiver alone", async ({
    assert,
  }) => {
    const mine = await seedObligation(B, A);
    stubMongo(activeCopy({ customer: C }));

    await recordTransfer(A, { blid: BLID });

    const [handover] = await BookHandover.all();
    assert.equal(handover!.dischargesReceiverObligationId, mine.id);
    assert.isNull(handover!.dischargesSenderObligationId);
  });

  test("an equivalent edition satisfies the receiver half", async ({ assert }) => {
    const mine = await seedObligation(B, A, GYMNOS_2009);
    stubMongo(activeCopy({ customer: B, item: GYMNOS_2012 }));

    await recordTransfer(A, { blid: BLID });

    const [handover] = await BookHandover.all();
    assert.equal(handover!.itemId, GYMNOS_2012);
    assert.equal(handover!.dischargesReceiverObligationId, mine.id);
  });

  test("receiving an equivalent edition closes the order for the edition the receiver ordered", async ({
    assert,
  }) => {
    // A ordered GYMNOS 2009 but receives B's GYMNOS 2012 copy. The receive order must record the
    // 2012 edition A actually got, and hand the 2009 order to the moved-order handler — which
    // closes equivalent editions — so A's original order does not stay open.
    await seedObligation(B, A, GYMNOS_2009);
    const { movedHandlerStub } = stubMongo(activeCopy({ customer: B, item: GYMNOS_2012 }), {
      orderedItem: GYMNOS_2009,
    });

    const { feedback } = await recordTransfer(A, { blid: BLID });

    assert.isUndefined(feedback);
    assert.equal(movedHandlerStub.callCount, 1);
    const receiveOrder = movedHandlerStub.firstCall.args[0];
    assert.equal(receiveOrder.orderItems[0]?.item, GYMNOS_2012);
    assert.equal(receiveOrder.orderItems[0]?.movedFromOrder, "receiver-rent-order");
  });

  test("scanning the same book twice records only one handover", async ({ assert }) => {
    await seedObligation(B, A);
    stubMongo(activeCopy({ customer: B }));

    await recordTransfer(A, { blid: BLID });
    const { feedback } = await recordTransfer(A, { blid: BLID });

    assert.isDefined(feedback);
    assert.lengthOf(await BookHandover.all(), 1);
  });

  test("refuses to record a handover for a copy with no BL-ID", async ({ assert }) => {
    await seedObligation(B, A);
    stubMongo(activeCopy({ customer: B, blid: undefined }));

    await assert.rejects(
      () => recordTransfer(A, { blid: BLID }),
      /Kan ikke registrere overlevering uten BL-ID/,
    );
  });

  test("writes nothing when the receiver has no obligation for the title", async ({ assert }) => {
    await seedObligation(B, C);
    stubMongo(activeCopy({ customer: B }));

    const { feedback } = await recordTransfer(A, { blid: BLID });

    assert.match(feedback ?? "", /ikke bestilt/);
    assert.isEmpty(await BookHandover.all());
  });

  test("tells a student who already received the title that, not 'never ordered'", async ({
    assert,
  }) => {
    // A already received their copy from B; now C hands A another copy of the same title.
    const obligation = await seedObligation(B, A);
    await MatchRepository.recordHandover({
      blid: "BL0009999999",
      itemId: ITEM_X,
      fromUserDetailId: B,
      toUserDetailId: A,
      occurredAt: DateTime.now(),
      orderId: null,
      dischargesSenderObligationId: obligation.id,
      dischargesReceiverObligationId: obligation.id,
    });
    stubMongo(activeCopy({ customer: C }));

    const { feedback } = await recordTransfer(A, { blid: BLID });

    assert.match(feedback ?? "", /allerede skannet/);
    assert.lengthOf(await BookHandover.all(), 1, "the second copy must not be recorded");
  });

  test("takes the discharge back when the Mongo side of the transfer fails", async ({ assert }) => {
    await seedObligation(B, A);
    stubMongo(activeCopy({ customer: B }));
    asStub(StorageService.CustomerItems.update).restore();
    sandbox.stub(StorageService.CustomerItems, "update").rejects(new Error("mongo down"));

    await assert.rejects(() => recordTransfer(A, { blid: BLID }), /mongo down/);

    assert.isEmpty(
      await BookHandover.all(),
      "a failed transfer must leave the obligation undischarged so the scan can be retried",
    );
  });

  test("rejects a barcode that is not a BL-ID", async ({ assert }) => {
    const { feedback } = await recordTransfer(A, { blid: "not-a-blid" });

    assert.match(feedback ?? "", /Feil strekkode/);
    assert.isEmpty(await BookHandover.all());
  });

  test("blocks a copy whose deadline has expired", async ({ assert }) => {
    await seedObligation(B, A);
    // A copy the sender kept past its deadline — overdue books must go to the stand, not transfer.
    stubMongo(
      activeCopy({
        customer: B,
        deadline: DateTime.now().minus({ years: 1 }).toJSDate(),
      }),
    );

    const { feedback } = await recordTransfer(A, { blid: BLID });

    assert.match(feedback ?? "", /utgått frist/);
    assert.match(feedback ?? "", /Bendik Buer må beholde boka/);
    assert.isEmpty(await BookHandover.all());
  });

  test("blocks an expired copy even when its deadline matches the round's", async ({ assert }) => {
    // Expiry is absolute: a copy past its deadline must never transfer, even in a round whose own
    // deadline has passed.
    const yesterday = DateTime.now().minus({ days: 1 }).startOf("day");
    round.deadline = yesterday;
    await round.save();
    await seedObligation(B, A);
    stubMongo(activeCopy({ customer: B, deadline: yesterday.toJSDate() }));

    const { feedback } = await recordTransfer(A, { blid: BLID });

    assert.match(feedback ?? "", /utgått frist/);
    assert.isEmpty(await BookHandover.all());
  });

  test("rejects a blid with no active copy behind it", async ({ assert }) => {
    await seedObligation(B, A);
    stubMongo(null);

    const { feedback } = await recordTransfer(A, { blid: BLID });

    assert.match(feedback ?? "", /ikke aktiv/);
    assert.isEmpty(await BookHandover.all());
  });
});
