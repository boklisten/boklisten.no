/* oxlint-disable unicorn/no-thenable -- $switch branches carry a then key by Mongo's design */
import { test } from "@japa/runner";

import { blidMatchTierExpression } from "#services/blid_search_service";

test.group("blidMatchTierExpression", () => {
  test("ranks exact, prefix, suffix and contains, typed casing before ignored casing", ({
    assert,
  }) => {
    const { $switch } = blidMatchTierExpression("AbCd");
    assert.deepEqual(
      $switch.branches.map(({ case: { $regexMatch }, then }) => ({
        regex: $regexMatch.regex,
        ignoreCase: $regexMatch.options === "i",
        then,
      })),
      [
        { regex: "^AbCd$", ignoreCase: false, then: 0 },
        { regex: "^AbCd$", ignoreCase: true, then: 1 },
        { regex: "^AbCd", ignoreCase: false, then: 2 },
        { regex: "^AbCd", ignoreCase: true, then: 3 },
        { regex: "AbCd$", ignoreCase: false, then: 4 },
        { regex: "AbCd$", ignoreCase: true, then: 5 },
        { regex: "AbCd", ignoreCase: false, then: 6 },
      ],
    );
  });

  test("falls through to the last tier for a match that only ignores casing anywhere", ({
    assert,
  }) => {
    const { $switch } = blidMatchTierExpression("AbCd");
    assert.equal($switch.default, 7);
  });
});
