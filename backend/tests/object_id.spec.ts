import { test } from "@japa/runner";

import { assignObjectId, isObjectIdHex, newObjectId } from "#models/helpers/object_id";
import { fixtureId } from "#tests/fixtures";

test.group("newObjectId", () => {
  test("produces a 24-character lowercase hex string", ({ assert }) => {
    const id = newObjectId();
    assert.match(id, /^[0-9a-f]{24}$/);
    assert.isTrue(isObjectIdHex(id));
  });

  test("embeds the current time in the first four bytes, so ids stay time-sortable", ({
    assert,
  }) => {
    const before = Math.floor(Date.now() / 1000);
    const seconds = Number.parseInt(newObjectId().slice(0, 8), 16);
    const after = Math.floor(Date.now() / 1000);
    assert.isAtLeast(seconds, before);
    assert.isAtMost(seconds, after);
  });

  test("does not repeat", ({ assert }) => {
    const ids = new Set(Array.from({ length: 1000 }, () => newObjectId()));
    assert.lengthOf(ids, 1000);
  });
});

test.group("isObjectIdHex", () => {
  test("rejects anything but 24 hex characters", ({ assert }) => {
    assert.isFalse(isObjectIdHex(""));
    assert.isFalse(isObjectIdHex("6100000000000000000000a"));
    assert.isFalse(isObjectIdHex("6100000000000000000000a1z"));
    assert.isFalse(isObjectIdHex("6100000000000000000000g1"));
    assert.isTrue(isObjectIdHex("6100000000000000000000A1"));
  });
});

test.group("assignObjectId", () => {
  test("fills an empty id and leaves a given one alone", ({ assert }) => {
    const fresh = { id: "" };
    assignObjectId(fresh);
    assert.isTrue(isObjectIdHex(fresh.id));

    const transferred = { id: "6100000000000000000000a1" };
    assignObjectId(transferred);
    assert.equal(transferred.id, "6100000000000000000000a1");
  });
});

test.group("fixtureId", () => {
  test("pads numbers and hex fragments to a valid 24-character id", ({ assert }) => {
    assert.equal(fixtureId(1), "000000000000000000000001");
    assert.equal(fixtureId("a1"), "0000000000000000000000a1");
    assert.equal(fixtureId("6100000000000000000000A1"), "6100000000000000000000a1");
    assert.throws(() => fixtureId("xyz"), /cannot build a fixture id/);
    assert.throws(() => fixtureId("6100000000000000000000a1ff"), /cannot build a fixture id/);
  });
});
