import { test } from "@japa/runner";

import { cleanUserInput } from "#validators/common/transformers";

test.group("cleanUserInput", () => {
  test("should title-case words and keep single separators")
    .with([
      { input: "lisa angellsen storvik", expected: "Lisa Angellsen Storvik" },
      { input: "lisa ANGELLSEN-storvik", expected: "Lisa Angellsen-Storvik" },
      { input: "  lisa   storvik  ", expected: "Lisa Storvik" },
    ])
    .run(({ assert }, { input, expected }) => {
      assert.equal(cleanUserInput(input), expected);
    });

  test("should never emit the text 'undefined' for {reason}")
    .with([
      {
        reason: "a hyphen followed by a space",
        input: "Lisa Angellsen- Storvik",
        expected: "Lisa Angellsen-Storvik",
      },
      {
        reason: "a space followed by a hyphen",
        input: "Lisa Angellsen -Storvik",
        expected: "Lisa Angellsen Storvik",
      },
      {
        reason: "a doubled hyphen",
        input: "Lisa Angellsen--Storvik",
        expected: "Lisa Angellsen-Storvik",
      },
      { reason: "a trailing hyphen", input: "Lisa Angellsen-", expected: "Lisa Angellsen" },
      { reason: "a leading hyphen", input: "-Lisa Angellsen", expected: "Lisa Angellsen" },
      { reason: "an empty string", input: "", expected: "" },
      { reason: "only separators", input: " - ", expected: "" },
    ])
    .run(({ assert }, { input, expected }) => {
      assert.equal(cleanUserInput(input), expected);
    });
});
