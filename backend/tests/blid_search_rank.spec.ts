import { test } from "@japa/runner";

import { blidMatchTier, compileMatchTiers, rankBlidMatches } from "#services/blid_search_service";

test.group("blidMatchTier", () => {
  test("ranks exact, prefix, suffix and contains, typed casing before ignored casing", ({
    assert,
  }) => {
    assert.deepEqual(
      ["AbCd", "abcd", "AbCd1234", "abcd1234", "1234AbCd", "1234abcd", "12AbCd34", "12abcd34"].map(
        (blid) => blidMatchTier(blid, compileMatchTiers("AbCd")),
      ),
      [0, 1, 2, 3, 4, 5, 6, 7],
    );
  });

  test("an exact blid in another casing beats every partial match", ({ assert }) => {
    const tiers = compileMatchTiers("AbCd");
    assert.isBelow(blidMatchTier("ABCD", tiers), blidMatchTier("AbCd1234", tiers));
  });
});

test.group("rankBlidMatches", () => {
  const matches = [
    { blid: "zz123456", itemId: "i" },
    { blid: "12345678", itemId: "i" },
    { blid: "1234abcd", itemId: "i" },
    { blid: "aa123456", itemId: "i" },
    { blid: "00001234", itemId: "i" },
  ];

  test("orders by tier, then held books first, then blid", ({ assert }) => {
    const held = new Map([
      ["zz123456", "customer-1"],
      ["1234abcd", "customer-2"],
    ]);
    assert.deepEqual(
      rankBlidMatches(matches, held, "1234").map((match) => match.blid),
      ["1234abcd", "12345678", "00001234", "zz123456", "aa123456"],
    );
  });

  test("a held blid that is not among the matches changes nothing", ({ assert }) => {
    const held = new Map([["legacy00", "customer-1"]]);
    assert.deepEqual(
      rankBlidMatches(matches, held, "1234").map((match) => match.blid),
      ["12345678", "1234abcd", "00001234", "aa123456", "zz123456"],
    );
  });
});
