import { test } from "@japa/runner";
import testUtils from "@adonisjs/core/services/test_utils";
import { DateTime } from "luxon";
import type sinon from "sinon";
import { spy, stub } from "sinon";

import Branch from "#models/branch";
import Signature from "#models/signature";
import User from "#models/user";
import type { GalleryContext, GalleryCustomer } from "#services/signature_gallery_service";
import { SignatureGalleryService } from "#services/signature_gallery_service";
import type { UserPermission } from "#shared/user-permission";
import { createBranch, TEST_ROOT_BRANCH_ID } from "#tests/branch_fixtures";
import { createOrder } from "#tests/order_fixtures";
import { createUser } from "#tests/user_fixtures";

const adultDob = DateTime.now().minus({ years: 30 }).startOf("year");
const childDob = DateTime.now().minus({ years: 10 }).startOf("year");

const emptyContext: GalleryContext = { branchNames: new Map() };

// Customer ids are 24-character ObjectId hex strings, like the real primary keys.
function customerIdFor(id: number): string {
  return id.toString(16).padStart(24, "0");
}

function makeSignature(overrides: {
  id: number;
  customerId?: string;
  createdAt?: DateTime;
  signedByGuardian?: boolean;
}): Signature {
  const signature = new Signature();
  signature.id = overrides.id;
  signature.customerId = overrides.customerId ?? customerIdFor(overrides.id);
  signature.createdAt = overrides.createdAt ?? DateTime.now().minus({ days: overrides.id });
  signature.signedByGuardian = overrides.signedByGuardian ?? false;
  signature.signingName = `Signerer ${overrides.id}`;
  signature.image = Buffer.from(`webp-${overrides.id}`);
  return signature;
}

function customerFor(
  signature: Signature,
  dob: DateTime = adultDob,
  branchMembershipId: string = TEST_ROOT_BRANCH_ID,
  permission: UserPermission = "customer",
): GalleryCustomer {
  return {
    id: signature.customerId,
    name: `Kunde ${signature.id}`,
    dob,
    branchMembershipId,
    permission,
  };
}

/** `User.byIds` stub payload: the customers keyed by id, as the users table would return them. */
function customersById(customers: GalleryCustomer[]): Map<string, User> {
  return new Map(
    customers.map((customer) => {
      const user = new User();
      user.fill(customer);
      return [customer.id, user];
    }),
  );
}

test.group("SignatureGalleryService cursor", () => {
  test("round-trips encode and decode", ({ assert }) => {
    const cursor = { createdAt: new Date("2026-08-30T12:00:00Z"), id: 42 };
    const decoded = SignatureGalleryService.decodeCursor(
      SignatureGalleryService.encodeCursor(cursor),
    );
    assert.deepEqual(decoded, cursor);
  });

  test("rejects malformed cursors", ({ assert }) => {
    assert.isNull(SignatureGalleryService.decodeCursor(undefined));
    assert.isNull(SignatureGalleryService.decodeCursor("not-a-cursor"));
    assert.isNull(SignatureGalleryService.decodeCursor("123_"));
    assert.isNull(SignatureGalleryService.decodeCursor("_123"));
    assert.isNull(SignatureGalleryService.decodeCursor("1_2_3"));
  });
});

test.group("SignatureGalleryService.toGalleryItem", () => {
  test("shapes a valid signature with the customer's name and base64 image", ({ assert }) => {
    const signature = makeSignature({ id: 1 });
    const item = SignatureGalleryService.toGalleryItem(
      signature,
      customerFor(signature),
      emptyContext,
    );
    assert.deepEqual(item, {
      id: 1,
      customerId: signature.customerId,
      customerName: "Kunde 1",
      signingName: "Signerer 1",
      signedByGuardian: false,
      signedAtText: item?.signedAtText ?? "",
      image: Buffer.from("webp-1").toString("base64"),
      branchName: null,
      permission: "customer",
    });
    assert.match(item?.signedAtText ?? "", /^\d{2}\/\d{2}\/\d{4}$/);
  });

  test("resolves the branch name from the context and the permission from the customer", ({
    assert,
  }) => {
    const signature = makeSignature({ id: 1 });
    const customer = customerFor(signature, adultDob, "branch-1", "employee");
    const item = SignatureGalleryService.toGalleryItem(signature, customer, {
      branchNames: new Map([["branch-1", "Ullern VGS"]]),
    });
    assert.equal(item?.branchName, "Ullern VGS");
    assert.equal(item?.permission, "employee");
  });

  test("leaves the branch empty when the membership points at an unknown branch", ({ assert }) => {
    const signature = makeSignature({ id: 1 });
    const customer = customerFor(signature, adultDob, "deleted-branch");
    const item = SignatureGalleryService.toGalleryItem(signature, customer, emptyContext);
    assert.isNull(item?.branchName);
  });

  test("drops a signature whose customer is missing", ({ assert }) => {
    const signature = makeSignature({ id: 1 });
    assert.isNull(SignatureGalleryService.toGalleryItem(signature, undefined, emptyContext));
  });

  test("drops an expired signature", ({ assert }) => {
    const signature = makeSignature({ id: 1, createdAt: DateTime.now().minus({ years: 5 }) });
    assert.isNull(
      SignatureGalleryService.toGalleryItem(signature, customerFor(signature), emptyContext),
    );
  });

  test("drops a guardian signature for a customer who is now an adult", ({ assert }) => {
    const signature = makeSignature({ id: 1, signedByGuardian: true });
    assert.isNull(
      SignatureGalleryService.toGalleryItem(
        signature,
        customerFor(signature, adultDob),
        emptyContext,
      ),
    );
  });

  test("keeps a guardian signature for an underage customer", ({ assert }) => {
    const signature = makeSignature({ id: 1, signedByGuardian: true });
    const item = SignatureGalleryService.toGalleryItem(
      signature,
      customerFor(signature, childDob),
      emptyContext,
    );
    assert.isTrue(item?.signedByGuardian);
  });
});

test.group("SignatureGalleryService.getPage", (group) => {
  let pageStub: sinon.SinonStub;
  let customersStub: sinon.SinonStub;
  let branchNamesSpy: sinon.SinonSpy;

  group.each.setup(() => testUtils.db().wrapInGlobalTransaction());
  group.each.setup(() => {
    pageStub = stub(Signature, "newestPerCustomerPage");
    customersStub = stub(User, "byIds");
    branchNamesSpy = spy(Branch, "namesByIds");
  });

  test("returns an empty final page when there are no rows", async ({ assert }) => {
    pageStub.resolves([]);
    const page = await SignatureGalleryService.getPage(null, TEST_ROOT_BRANCH_ID);
    assert.deepEqual(page, { signatures: [], nextCursor: null });
  });

  test("filters out invalid signatures and ends paging on a short batch", async ({ assert }) => {
    const valid = makeSignature({ id: 1 });
    const expired = makeSignature({ id: 2, createdAt: DateTime.now().minus({ years: 5 }) });
    const orphaned = makeSignature({ id: 3 });
    pageStub.resolves([valid, expired, orphaned]);
    customersStub.resolves(customersById([customerFor(valid), customerFor(expired)]));

    const page = await SignatureGalleryService.getPage(null, TEST_ROOT_BRANCH_ID);

    assert.deepEqual(
      page.signatures.map((signature) => signature.id),
      [1],
    );
    assert.isNull(page.nextCursor);
  });

  test("stops at the page size and resumes from the last judged row", async ({ assert }) => {
    const rows = Array.from({ length: 50 }, (_, index) => makeSignature({ id: index + 1 }));
    pageStub.resolves(rows);
    customersStub.resolves(customersById(rows.map((row) => customerFor(row))));

    const page = await SignatureGalleryService.getPage(null, TEST_ROOT_BRANCH_ID);

    assert.lengthOf(page.signatures, 30);
    const lastJudged = rows[29];
    assert.equal(
      page.nextCursor,
      SignatureGalleryService.encodeCursor({
        createdAt: lastJudged?.createdAt.toJSDate() ?? new Date(0),
        id: lastJudged?.id ?? 0,
      }),
    );
  });

  test("fetches further batches when a full batch does not fill the page", async ({ assert }) => {
    const firstBatch = Array.from({ length: 50 }, (_, index) =>
      makeSignature({ id: index + 1, createdAt: DateTime.now().minus({ years: 5 }) }),
    );
    const secondBatch = [makeSignature({ id: 100 })];
    pageStub.onFirstCall().resolves(firstBatch);
    pageStub.onSecondCall().resolves(secondBatch);
    customersStub.onFirstCall().resolves(customersById(firstBatch.map((row) => customerFor(row))));
    customersStub
      .onSecondCall()
      .resolves(customersById(secondBatch.map((row) => customerFor(row))));

    const page = await SignatureGalleryService.getPage(null, TEST_ROOT_BRANCH_ID);

    assert.deepEqual(
      page.signatures.map((signature) => signature.id),
      [100],
    );
    assert.isNull(page.nextCursor);
    const secondCallCursor = pageStub.secondCall.args[0];
    assert.equal(secondCallCursor?.id, 50);
  });

  test("decorates items with the customer's branch name and elevated permission", async ({
    assert,
  }) => {
    const branchId = "b".repeat(24);
    const signature = makeSignature({ id: 1 });
    const customer = customerFor(signature, adultDob, branchId, "admin");
    pageStub.resolves([signature]);
    customersStub.resolves(customersById([customer]));
    await createBranch({ id: branchId, name: "Ullern VGS" });

    const page = await SignatureGalleryService.getPage(null, TEST_ROOT_BRANCH_ID);

    assert.equal(page.signatures[0]?.branchName, "Ullern VGS");
    assert.equal(page.signatures[0]?.permission, "admin");
  });

  test("skips the branch lookup when no customer has a membership", async ({ assert }) => {
    const signature = makeSignature({ id: 1 });
    pageStub.resolves([signature]);
    customersStub.resolves(customersById([customerFor(signature)]));

    const page = await SignatureGalleryService.getPage(null, TEST_ROOT_BRANCH_ID);

    assert.isNull(page.signatures[0]?.branchName);
    assert.isFalse(branchNamesSpy.called);
  });
});

async function sign(customerId: string, signingName: string): Promise<Signature> {
  return Signature.create({
    customerId,
    signingName,
    signedByGuardian: false,
    image: Buffer.from("webp"),
  });
}

test.group("SignatureGalleryService.getPage scope", (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction());

  test("holds only the members of the node and the branches below it", async ({ assert }) => {
    const school = await createBranch({ name: "Ullern VGS" });
    const klass = await createBranch({ parentBranchId: school.id, name: "VG1 ST A" });
    const sibling = await createBranch({ name: "Nydalen VGS" });
    const pupil = await createUser({ branchMembershipId: klass.id, dob: adultDob });
    // Ordered here without picking the school: counted by the scope rule, not by this tab.
    const privatist = await createUser({ dob: adultDob });
    const elsewhere = await createUser({ branchMembershipId: sibling.id, dob: adultDob });
    await createOrder({ branchId: school.id, customerId: privatist.id });
    await sign(pupil.id, "Elev Elevsen");
    await sign(privatist.id, "Privatist Privatistsen");
    await sign(elsewhere.id, "Nabo Nabosen");

    const page = await SignatureGalleryService.getPage(null, school.id);

    assert.deepEqual(
      page.signatures.map((signature) => signature.customerId),
      [pupil.id],
    );
    assert.equal(page.signatures[0]?.branchName, "VG1 ST A");
    assert.isNull(page.nextCursor);
  });

  test("holds everyone on the root", async ({ assert }) => {
    const school = await createBranch();
    const pupil = await createUser({ branchMembershipId: school.id, dob: adultDob });
    const privatist = await createUser({ dob: adultDob });
    await sign(pupil.id, "Elev Elevsen");
    await sign(privatist.id, "Privatist Privatistsen");

    const page = await SignatureGalleryService.getPage(null, TEST_ROOT_BRANCH_ID);

    assert.lengthOf(page.signatures, 2);
  });
});
