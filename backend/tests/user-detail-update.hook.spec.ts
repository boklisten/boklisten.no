import { test } from "@japa/runner";
import { createSandbox } from "sinon";

import { UserDetailUpdateHook } from "#services/legacy/collections/user-detail/hooks/user-detail-update.hook";
import { StorageService } from "#services/storage_service";
import type { AccessToken } from "#shared/access-token";
import { mock } from "#tests/test-doubles";

const customerAccessToken = mock<AccessToken>({ permission: "customer" });
const adminAccessToken = mock<AccessToken>({ permission: "admin" });

test.group("UserDetailUpdateHook", async (group) => {
  const userDetailUpdateHook = new UserDetailUpdateHook();

  let sandbox: sinon.SinonSandbox;
  group.each.setup(() => {
    sandbox = createSandbox();
    sandbox.stub(StorageService.UserDetails, "getByQuery").callsFake(() => Promise.resolve([]));
  });
  group.each.teardown(() => {
    sandbox.restore();
  });

  test("should do proper capitalization with latin letters", async ({ assert }) => {
    const body = {
      name: "siri matheus berge",
      address: "portalgata 15c",
      postCity: "bartebyen",
    };
    const expected = {
      name: "Siri Matheus Berge",
      address: "Portalgata 15c",
      postCity: "Bartebyen",
    };
    const result = await userDetailUpdateHook.before(body, customerAccessToken);
    assert.deepEqual(result, expected);
  });

  test("should do proper capitalization and spacing with Norwegian letters", async ({ assert }) => {
    const body = {
      name: "        TOR åGE       bRingsVær       ",
      address: "øygatÆn     ",
      postCity: "æresGøta   ",
    };
    const expected = {
      name: "Tor Åge Bringsvær",
      address: "Øygatæn",
      postCity: "Æresgøta",
    };
    const result = await userDetailUpdateHook.before(body, customerAccessToken);
    assert.deepEqual(result, expected);
  });

  test("should do proper capitalization on exotic characters", async ({ assert }) => {
    const body = {
      name: "İgiorİ ßißßa",
      address: "łFEłŁlo 12ł",
      postCity: "æresGøta   ",
    };
    const expected = {
      name: "İgiori̇ SSißßa",
      address: "Łfełłlo 12ł",
      postCity: "Æresgøta",
    };
    const result = await userDetailUpdateHook.before(body, customerAccessToken);
    assert.deepEqual(result, expected);
  });

  test("should capitalize each part of hyphenated names", async ({ assert }) => {
    const body = {
      name: "john maYor-taylor",
      address: "johnson st  2",
      postCity: "æresGøta   ",
    };
    const expected = {
      name: "John Mayor-Taylor",
      address: "Johnson St 2",
      postCity: "Æresgøta",
    };
    const result = await userDetailUpdateHook.before(body, customerAccessToken);
    assert.deepEqual(result, expected);
  });

  test("should disallow email-confirmed status change by customer", async ({ assert }) => {
    const body = {
      emailConfirmed: true,
    };
    await assert.rejects(() => userDetailUpdateHook.before(body, customerAccessToken));
  });

  test("should allow email-confirmed status change by admin", async ({ assert }) => {
    const body = {
      emailConfirmed: true,
    };
    const expected = {
      emailConfirmed: true,
    };
    const result = await userDetailUpdateHook.before(body, adminAccessToken);
    assert.deepEqual(result, expected);
  });

  test("should allow patch by customer", async ({ assert }) => {
    const body = {
      name: "1",
      postCode: "3",
      address: "4",
      postCity: "5",
      phone: "6",
      dob: "2023-02-02",
    };
    const expected = { ...body };
    const result = await userDetailUpdateHook.before(body, customerAccessToken);
    assert.deepEqual(result, expected);
  });

  test("should error on wrongly-typed {$self}")
    .with(["name", "address", "phone", "postCity", "postCode", "dob", "emailConfirmed"])
    .run(({ assert }, property) =>
      assert.rejects(() => userDetailUpdateHook.before({ [property]: 2 }, adminAccessToken)),
    );
});
