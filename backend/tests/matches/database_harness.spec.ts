import { test } from "@japa/runner";
import testUtils from "@adonisjs/core/services/test_utils";
import db from "@adonisjs/lucid/services/db";

test.group("database harness", (group) => {
  group.each.setup(() => testUtils.db().truncate());

  test("connects to postgres and starts from a clean slate", async ({ assert }) => {
    await db.table("editable_texts").insert({ id: "harness-probe", text: "probe" });
    const rows = await db.from("editable_texts").select("id");
    assert.lengthOf(rows, 1);
  });

  test("truncate hook clears rows between tests", async ({ assert }) => {
    const rows = await db.from("editable_texts").select("id");
    assert.lengthOf(rows, 0);
  });
});
