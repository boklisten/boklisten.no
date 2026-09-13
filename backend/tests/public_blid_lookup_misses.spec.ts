import limiter from "@adonisjs/limiter/services/main";
import { test } from "@japa/runner";
import type sinon from "sinon";
import { createSandbox } from "sinon";

import { PublicBlidLookupService } from "#services/public_blid_lookup_service";
import type { PublicBlidLookupResult } from "#shared/public_blid_lookup";

const NOW = new Date("2026-09-13T12:00:00.000Z");
const KNOWN: PublicBlidLookupResult = {
  status: "notHandedOut",
  title: "Sinus 1T",
  isbn: "9788202418304",
};
const UNKNOWN: PublicBlidLookupResult = { status: "unregistered" };

test.group("PublicBlidLookupService.guardedLookup()", (group) => {
  let sandbox: sinon.SinonSandbox;
  let lookup: sinon.SinonStub;
  let account = 0;
  let detailsId: string;
  // The real limiter on the in-memory store: the behaviour under test is the counting itself.
  const misses = limiter.use("memory", { requests: 10, duration: "1 day", blockDuration: "1 day" });

  group.each.setup(() => {
    sandbox = createSandbox();
    lookup = sandbox.stub(PublicBlidLookupService, "lookup");
    account += 1;
    detailsId = `5f7f7f7f7f7f7f7f7f7f7f${String(account).padStart(2, "0")}`;
  });
  group.each.teardown(() => sandbox.restore());

  async function lookUp(outcome: PublicBlidLookupResult) {
    lookup.resolves(outcome);
    return PublicBlidLookupService.guardedLookup({ detailsId, blid: "12345678" }, misses, NOW);
  }

  test("ten unknown IDs in a day suspend the account for 24 hours, even for a known book", async ({
    assert,
  }) => {
    for (let index = 0; index < 10; index++) {
      assert.deepEqual(await lookUp(UNKNOWN), UNKNOWN);
    }
    lookup.resetHistory();

    const result = await lookUp(KNOWN);

    assert.deepEqual(result, { status: "suspended", until: "2026-09-14T12:00:00.000Z" });
    assert.isFalse(lookup.called, "a suspended account does not get to look anything up");
  });

  test("known books never count against the account", async ({ assert }) => {
    for (let index = 0; index < 20; index++) {
      assert.deepEqual(await lookUp(KNOWN), KNOWN);
    }
  });

  test("a known book in between does not reset the misses already counted", async ({ assert }) => {
    for (let index = 0; index < 5; index++) {
      await lookUp(UNKNOWN);
    }
    await lookUp(KNOWN);
    for (let index = 0; index < 5; index++) {
      await lookUp(UNKNOWN);
    }

    const result = await lookUp(KNOWN);

    assert.equal(result.status, "suspended");
  });

  test("the suspension is per account", async ({ assert }) => {
    for (let index = 0; index < 10; index++) {
      await lookUp(UNKNOWN);
    }
    detailsId = "5f7f7f7f7f7f7f7f7f7f7fff";

    assert.deepEqual(await lookUp(KNOWN), KNOWN);
  });
});
