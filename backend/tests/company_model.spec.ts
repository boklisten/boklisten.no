import { test } from "@japa/runner";
import testUtils from "@adonisjs/core/services/test_utils";

import Company from "#models/company";
import { isObjectIdHex } from "#models/helpers/object_id";
import { createCompany } from "#tests/company_fixtures";

test.group("Company model", (group) => {
  group.each.setup(() => testUtils.db().truncate());

  test("a new company gets an ObjectId-shaped primary key", async ({ assert }) => {
    const company = await createCompany({ id: "" });
    assert.isTrue(isObjectIdHex(company.id));
    assert.equal((await Company.findOrFail(company.id)).id, company.id);
  });

  test("allByName sorts Norwegian letters after Z", async ({ assert }) => {
    await createCompany({ name: "Østfold fylkeskommune" });
    await createCompany({ name: "Wang AS" });
    await createCompany({ name: "Akershus fylkeskommune" });
    assert.deepEqual(
      (await Company.allByName()).map((company) => company.name),
      ["Akershus fylkeskommune", "Wang AS", "Østfold fylkeskommune"],
    );
  });
});
