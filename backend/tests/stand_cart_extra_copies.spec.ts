import { test } from "@japa/runner";

import { findExtraCopies } from "#shared/stand_cart";
import type { StandCartActionType, StandCartLine, StandCartNote } from "#shared/stand_cart";
import { mock } from "#tests/test-doubles";

// GYMNOS 2009 and GYMNOS 2012 are one title
const GYMNOS_2009 = "5b6441c4d2e733002fae89a6";
const GYMNOS_2012 = "5b6441b2d2e733002fae87a6";
const SINUS = "5f7f7f7f7f7f7f7f7f7f7f21";
const HELD_ID = "5f7f7f7f7f7f7f7f7f7f7f41";

type Line = Pick<StandCartLine, "key" | "source" | "itemId" | "title" | "notes">;

function copy(itemId: string, title: string, blid: string, notes: StandCartNote[] = []): Line {
  return mock<Line>({
    key: `item:${blid}`,
    source: { kind: "item", itemId, blid },
    itemId,
    title,
    notes,
  });
}

function heldCopy(itemId: string, title: string): Line {
  return mock<Line>({
    key: `customerItem:${HELD_ID}`,
    source: { kind: "customerItem", customerItemId: HELD_ID },
    itemId,
    title,
    notes: [],
  });
}

const HELD_NOTE: StandCartNote = {
  kind: "already-held",
  customerItemId: HELD_ID,
  title: "GYMNOS 2009",
};

const withType = (line: Line, type: StandCartActionType = "rent") => ({ line, type });

test.group("findExtraCopies", () => {
  test("an ordinary cart has none", ({ assert }) => {
    assert.deepEqual(
      findExtraCopies([
        withType(copy(GYMNOS_2012, "GYMNOS 2012", "1")),
        withType(copy(SINUS, "Sinus 1T", "2")),
      ]),
      [],
    );
  });

  test("a copy of a title the customer is holding is one too many, named by the held edition", ({
    assert,
  }) => {
    assert.deepEqual(
      findExtraCopies([withType(copy(GYMNOS_2012, "GYMNOS 2012", "1", [HELD_NOTE]))]),
      [
        {
          key: "item:1",
          reason: "Kunden har allerede «GYMNOS 2009»",
          message:
            "Kunden har allerede «GYMNOS 2009». Kontakt en administrator for å dele ut et ekstra eksemplar.",
        },
      ],
    );
  });

  test("the held copy does not count when the same cart takes it back", ({ assert }) => {
    for (const type of ["return", "cancel", "buyback"] as const) {
      assert.deepEqual(
        findExtraCopies([
          withType(heldCopy(GYMNOS_2009, "GYMNOS 2009"), type),
          withType(copy(GYMNOS_2012, "GYMNOS 2012", "1", [HELD_NOTE])),
        ]),
        [],
        type,
      );
    }
  });

  test("the held copy still counts when the same cart extends or buys it out", ({ assert }) => {
    for (const type of ["extend", "buyout"] as const) {
      assert.lengthOf(
        findExtraCopies([
          withType(heldCopy(GYMNOS_2009, "GYMNOS 2009"), type),
          withType(copy(GYMNOS_2012, "GYMNOS 2012", "1", [HELD_NOTE])),
        ]),
        1,
        type,
      );
    }
  });

  test("the second handout of one title in a cart is the extra one, across editions", ({
    assert,
  }) => {
    const extras = findExtraCopies([
      withType(copy(GYMNOS_2009, "GYMNOS 2009", "1")),
      withType(copy(GYMNOS_2012, "GYMNOS 2012", "2"), "buy"),
    ]);
    assert.deepEqual(extras, [
      {
        key: "item:2",
        reason: "«GYMNOS 2012» ligger allerede i handlekurven",
        message:
          "«GYMNOS 2012» ligger allerede i handlekurven. Kontakt en administrator for å dele ut et ekstra eksemplar.",
      },
    ]);
  });

  test("only handouts count: cancelling an ordered copy next to a handout of the same title is fine", ({
    assert,
  }) => {
    assert.deepEqual(
      findExtraCopies([
        withType(copy(SINUS, "Sinus 1T", "1"), "cancel"),
        withType(copy(SINUS, "Sinus 1T", "2")),
      ]),
      [],
    );
  });
});
