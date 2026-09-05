import { test } from "@japa/runner";

import { planBlidRegistration } from "#services/blid_registration_service";
import type { BlidRegistrationSources } from "#services/blid_registration_service";

const SINUS = { id: "item-sinus", title: "Sinus 1T" };

function sources(overrides: Partial<BlidRegistrationSources> = {}): BlidRegistrationSources {
  return {
    item: SINUS,
    blids: ["12345678", "1234abcdEFGH", "87654321"],
    existing: [],
    ...overrides,
  };
}

test.group("planBlidRegistration", () => {
  test("links every blid that is not in the database yet", ({ assert }) => {
    const plan = planBlidRegistration(sources());
    assert.deepEqual(plan, {
      kind: "ok",
      toAdd: ["12345678", "1234abcdEFGH", "87654321"],
      skipped: [],
    });
  });

  test("skips blids already linked to the same book instead of writing them again", ({
    assert,
  }) => {
    const plan = planBlidRegistration(
      sources({ existing: [{ blid: "12345678", item: SINUS.id, title: SINUS.title }] }),
    );
    assert.deepEqual(plan, {
      kind: "ok",
      toAdd: ["1234abcdEFGH", "87654321"],
      skipped: ["12345678"],
    });
  });

  test("refuses the whole batch when a blid is linked to another book", ({ assert }) => {
    const plan = planBlidRegistration(
      sources({
        existing: [
          { blid: "12345678", item: SINUS.id, title: SINUS.title },
          { blid: "87654321", item: "item-kosmos", title: "Kosmos SF" },
        ],
      }),
    );
    assert.deepEqual(plan, {
      kind: "conflict",
      conflicts: [{ blid: "87654321", linkedTo: { itemId: "item-kosmos", title: "Kosmos SF" } }],
    });
  });

  test("scans the same sticker twice as one blid", ({ assert }) => {
    const plan = planBlidRegistration(sources({ blids: ["12345678", "12345678"] }));
    assert.deepEqual(plan, { kind: "ok", toAdd: ["12345678"], skipped: [] });
  });
});
