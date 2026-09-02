import { test } from "@japa/runner";

import { assembleBlidSearchHits } from "#services/blid_search_service";
import type { BlidSearchHitSources } from "#services/blid_search_service";

const IDA = "ida-id";
const PETRA = "petra-id";

function sources(overrides: Partial<BlidSearchHitSources> = {}): BlidSearchHitSources {
  return {
    uniqueItems: [
      { blid: "12340000", title: "Kosmos SF" },
      { blid: "12345678", title: "Sinus 1T" },
      { blid: "1234abcdEFGH", title: "Gyldendal Norsk" },
    ],
    holders: new Map([
      ["12345678", IDA],
      ["1234abcdEFGH", PETRA],
    ]),
    userDetails: new Map([[IDA, "Ida"]]),
    ...overrides,
  };
}

test.group("assembleBlidSearchHits", () => {
  test("keeps the given order", ({ assert }) => {
    const hits = assembleBlidSearchHits(sources());
    assert.deepEqual(
      hits.map((hit) => hit.blid),
      ["12340000", "12345678", "1234abcdEFGH"],
    );
  });

  test("attaches the holder's name, falling back when the user detail is gone", ({ assert }) => {
    const hits = assembleBlidSearchHits(sources());
    const byBlid = new Map(hits.map((hit) => [hit.blid, hit.holder]));
    assert.deepEqual(byBlid.get("12345678"), { detailsId: IDA, name: "Ida" });
    assert.deepEqual(byBlid.get("1234abcdEFGH"), { detailsId: PETRA, name: "Ukjent" });
    assert.isNull(byBlid.get("12340000"));
  });

  test("returns an empty list when nothing matched", ({ assert }) => {
    assert.deepEqual(assembleBlidSearchHits(sources({ uniqueItems: [] })), []);
  });
});
