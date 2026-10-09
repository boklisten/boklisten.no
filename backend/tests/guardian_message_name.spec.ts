import { test } from "@japa/runner";

import { nameForGuardianMessage } from "#services/dispatch_service";

test.group("nameForGuardianMessage()", () => {
  test("keeps an ordinary name as it is", ({ assert }) => {
    assert.equal(nameForGuardianMessage("Ola Nordmann"), "Ola Nordmann");
    assert.equal(nameForGuardianMessage("Åse-Marie J. Øvrebø"), "Åse-Marie J. Øvrebø");
  });

  test("drops links and domains from the name", ({ assert }) => {
    assert.equal(
      nameForGuardianMessage("Ola. Betal gebyret på https://evil.example/pay i dag"),
      "Ola. Betal gebyret på i dag",
    );
    assert.equal(nameForGuardianMessage("Ola www.evil.no"), "Ola");
    assert.equal(nameForGuardianMessage("Ola bit.ly/x3 svindel@evil.no"), "Ola");
  });

  test("caps a long name", ({ assert }) => {
    const capped = nameForGuardianMessage("Ola ".repeat(30));
    assert.isAtMost(capped?.length ?? 0, 40);
    assert.isTrue(capped?.endsWith("…"));
  });

  test("answers null when nothing usable is left", ({ assert }) => {
    assert.isNull(nameForGuardianMessage(null));
    assert.isNull(nameForGuardianMessage("  https://evil.example  "));
  });
});
