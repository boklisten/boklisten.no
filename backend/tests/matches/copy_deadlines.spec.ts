import { test } from "@japa/runner";
import sinon, { createSandbox } from "sinon";

import { extendRemainingCopyDeadlines } from "#services/matches/copy_deadlines";
import { StorageService } from "#services/storage_service";
import { unchecked } from "#tests/test-doubles";

const A = "5d765db5fc8c47001c408d81";
const GYMNOS_2009 = "5b6441c4d2e733002fae89a6";
const GYMNOS_2012 = "5b6441b2d2e733002fae87a6";

const JUNE = new Date("2026-06-15T00:00:00Z");
const AUGUST = new Date("2026-08-20T00:00:00Z");

test.group("extendRemainingCopyDeadlines", (group) => {
  let sandbox: sinon.SinonSandbox;

  group.each.setup(() => {
    sandbox = createSandbox();
  });
  group.each.teardown(() => sandbox.restore());

  function stubRemaining(remaining: { id: string; deadline: Date }[]) {
    sandbox.stub(StorageService.CustomerItems, "aggregate").resolves(remaining);
    return sandbox.stub(StorageService.CustomerItems, "update").resolves(unchecked({}));
  }

  test("the kept copy inherits the later deadline of the pair", async ({ assert }) => {
    // The VG1 student: their own Gymnos is due in June, the one they were given in June runs to
    // August. They hand over the August copy, so the copy they keep must run to August too.
    const update = stubRemaining([{ id: "ci-june", deadline: JUNE }]);

    await extendRemainingCopyDeadlines(A, GYMNOS_2009, AUGUST);

    assert.equal(update.calledOnce, true);
    assert.equal(update.firstCall.args[0], "ci-june");
    assert.deepEqual(update.firstCall.args[1], { deadline: AUGUST });
  });

  test("a copy already running longer is left alone", async ({ assert }) => {
    const update = stubRemaining([{ id: "ci-august", deadline: AUGUST }]);

    await extendRemainingCopyDeadlines(A, GYMNOS_2009, JUNE);

    assert.equal(update.called, false);
  });

  test("does nothing when no copies remain", async ({ assert }) => {
    const update = stubRemaining([]);

    await extendRemainingCopyDeadlines(A, GYMNOS_2009, AUGUST);

    assert.equal(update.called, false);
  });

  test("extends every remaining copy that is running short", async ({ assert }) => {
    const update = stubRemaining([
      { id: "ci-1", deadline: JUNE },
      { id: "ci-2", deadline: JUNE },
      { id: "ci-3", deadline: AUGUST },
    ]);

    await extendRemainingCopyDeadlines(A, GYMNOS_2009, AUGUST);

    assert.equal(update.callCount, 2);
  });

  test("looks across equivalent editions", async ({ assert }) => {
    // A student can hold GYMNOS 2009 and GYMNOS 2012 interchangeably, so both count as the
    // same title when deciding which deadline the kept copy carries.
    const aggregate = sandbox
      .stub(StorageService.CustomerItems, "aggregate")
      .resolves(unchecked([]));
    sandbox.stub(StorageService.CustomerItems, "update").resolves(unchecked({}));

    await extendRemainingCopyDeadlines(A, GYMNOS_2009, AUGUST);

    const pipeline: { $match: { item: { $in: unknown[] } } }[] = unchecked(
      aggregate.firstCall.args[0],
    );
    assert.lengthOf(pipeline[0]!.$match.item.$in, 2);
    assert.include(
      pipeline[0]!.$match.item.$in.map(String),
      GYMNOS_2012,
      "the equivalent edition must be included",
    );
  });
});
