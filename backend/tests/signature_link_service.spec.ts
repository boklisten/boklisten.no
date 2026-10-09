import testUtils from "@adonisjs/core/services/test_utils";
import { test } from "@japa/runner";
import { DateTime } from "luxon";

import SignatureLink from "#models/signature_link";
import { SignatureLinkService } from "#services/signature_link_service";
import { clientOrigin } from "#config/app";
import { createUser } from "#tests/user_fixtures";

function tokenOf(url: string): string {
  const prefix = `${clientOrigin}/signering/`;
  if (!url.startsWith(prefix)) {
    throw new Error(`unexpected signing url ${url}`);
  }
  return url.slice(prefix.length);
}

async function expireIn(userId: string, days: number) {
  await SignatureLink.query()
    .where("userId", userId)
    .update({ expiresAt: DateTime.now().plus({ days }).toSQL() });
}

test.group("SignatureLinkService", (group) => {
  group.each.setup(() => testUtils.db().truncate());

  test("issues a random token, not the customer's id, and stores only its hash in the clear", async ({
    assert,
  }) => {
    const customer = await createUser();
    const token = tokenOf(await SignatureLinkService.urlFor(customer));

    assert.notInclude(token, customer.id);
    assert.isAtLeast(token.length, 43);
    const stored = await SignatureLink.findByOrFail("userId", customer.id);
    assert.notEqual(stored.tokenHash, token);
    assert.notInclude(stored.tokenEncrypted, token);
  });

  test("resolves a live token to its customer", async ({ assert }) => {
    const customer = await createUser();
    const token = tokenOf(await SignatureLinkService.urlFor(customer));

    assert.equal((await SignatureLinkService.customerFor(token))?.id, customer.id);
  });

  test("resolves no customer for an unknown token, the customer's id or an expired link", async ({
    assert,
  }) => {
    const customer = await createUser();
    const token = tokenOf(await SignatureLinkService.urlFor(customer));

    assert.isNull(await SignatureLinkService.customerFor("not-a-token"));
    assert.isNull(await SignatureLinkService.customerFor(customer.id));
    await expireIn(customer.id, -1);
    assert.isNull(await SignatureLinkService.customerFor(token));
  });

  test("sends the live link again while it has more than a week left", async ({ assert }) => {
    const customer = await createUser();
    const first = await SignatureLinkService.urlFor(customer);
    await expireIn(customer.id, 8);

    assert.equal(await SignatureLinkService.urlFor(customer), first);
  });

  test("replaces a link that expires within a week, and the old token stops working", async ({
    assert,
  }) => {
    const customer = await createUser();
    const oldToken = tokenOf(await SignatureLinkService.urlFor(customer));
    await expireIn(customer.id, 6);

    const newToken = tokenOf(await SignatureLinkService.urlFor(customer));

    assert.notEqual(newToken, oldToken);
    assert.isNull(await SignatureLinkService.customerFor(oldToken));
    assert.equal((await SignatureLinkService.customerFor(newToken))?.id, customer.id);
    assert.lengthOf(await SignatureLink.query().where("userId", customer.id), 1);
  });

  test("keeps one link per customer", async ({ assert }) => {
    const [ola, kari] = await Promise.all([createUser(), createUser()]);
    const olaToken = tokenOf(await SignatureLinkService.urlFor(ola));
    const kariToken = tokenOf(await SignatureLinkService.urlFor(kari));

    assert.notEqual(olaToken, kariToken);
    assert.equal((await SignatureLinkService.customerFor(kariToken))?.id, kari.id);
  });
});
