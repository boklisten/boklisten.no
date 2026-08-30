import { test } from "@japa/runner";
import { DateTime } from "luxon";
import { ObjectId } from "mongodb";
import sinon, { createSandbox } from "sinon";

import Signature from "#models/signature";
import {
  GalleryContext,
  GalleryCustomer,
  SignatureGalleryService,
} from "#services/signature_gallery_service";
import { StorageService } from "#services/storage_service";
import { unchecked } from "#tests/test-doubles";

const adultDob = new Date(new Date().getFullYear() - 30, 0, 1);
const childDob = new Date(new Date().getFullYear() - 10, 0, 1);

const emptyContext: GalleryContext = { branchNames: new Map(), permissions: new Map() };

// getPage feeds the ids into Mongo aggregations, so they must be valid ObjectId hex strings.
function customerDetailsIdFor(id: number): string {
  return id.toString(16).padStart(24, "0");
}

function makeSignature(overrides: {
  id: number;
  customerDetailsId?: string;
  createdAt?: DateTime;
  signedByGuardian?: boolean;
}): Signature {
  const signature = new Signature();
  signature.id = overrides.id;
  signature.customerDetailsId = overrides.customerDetailsId ?? customerDetailsIdFor(overrides.id);
  signature.createdAt = overrides.createdAt ?? DateTime.now().minus({ days: overrides.id });
  signature.signedByGuardian = overrides.signedByGuardian ?? false;
  signature.signingName = `Signerer ${overrides.id}`;
  signature.image = Buffer.from(`webp-${overrides.id}`);
  return signature;
}

function customerFor(
  signature: Signature,
  dob: Date = adultDob,
  branchMembership?: string,
): GalleryCustomer {
  return { id: signature.customerDetailsId, name: `Kunde ${signature.id}`, dob, branchMembership };
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
      customerDetailsId: signature.customerDetailsId,
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

  test("resolves branch name and elevated permission from the context", ({ assert }) => {
    const signature = makeSignature({ id: 1 });
    const customer = customerFor(signature, adultDob, "branch-1");
    const item = SignatureGalleryService.toGalleryItem(signature, customer, {
      branchNames: new Map([["branch-1", "Ullern VGS"]]),
      permissions: new Map([[customer.id, "employee"]]),
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
  let sandbox: sinon.SinonSandbox;
  let pageStub: sinon.SinonStub;
  let customersStub: sinon.SinonStub;
  let usersAggregateStub: sinon.SinonStub;
  let branchesAggregateStub: sinon.SinonStub;

  group.each.setup(() => {
    sandbox = createSandbox();
    pageStub = sandbox.stub(Signature, "newestPerCustomerPage");
    customersStub = sandbox.stub(StorageService.UserDetails, "getMany");
    usersAggregateStub = sandbox.stub(StorageService.Users, "aggregate").resolves([]);
    branchesAggregateStub = sandbox.stub(StorageService.Branches, "aggregate").resolves([]);
    return () => sandbox.restore();
  });

  test("returns an empty final page when there are no rows", async ({ assert }) => {
    pageStub.resolves([]);
    const page = await SignatureGalleryService.getPage(null);
    assert.deepEqual(page, { signatures: [], nextCursor: null });
  });

  test("filters out invalid signatures and ends paging on a short batch", async ({ assert }) => {
    const valid = makeSignature({ id: 1 });
    const expired = makeSignature({ id: 2, createdAt: DateTime.now().minus({ years: 5 }) });
    const orphaned = makeSignature({ id: 3 });
    pageStub.resolves([valid, expired, orphaned]);
    customersStub.resolves(unchecked([customerFor(valid), customerFor(expired)]));

    const page = await SignatureGalleryService.getPage(null);

    assert.deepEqual(
      page.signatures.map((signature) => signature.id),
      [1],
    );
    assert.isNull(page.nextCursor);
  });

  test("stops at the page size and resumes from the last judged row", async ({ assert }) => {
    const rows = Array.from({ length: 50 }, (_, index) => makeSignature({ id: index + 1 }));
    pageStub.resolves(rows);
    customersStub.resolves(unchecked(rows.map((row) => customerFor(row))));

    const page = await SignatureGalleryService.getPage(null);

    assert.lengthOf(page.signatures, 30);
    const lastJudged = rows[29];
    assert.equal(
      page.nextCursor,
      SignatureGalleryService.encodeCursor({
        createdAt: lastJudged?.createdAt?.toJSDate() ?? new Date(0),
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
    customersStub.onFirstCall().resolves(unchecked(firstBatch.map((row) => customerFor(row))));
    customersStub.onSecondCall().resolves(unchecked(secondBatch.map((row) => customerFor(row))));

    const page = await SignatureGalleryService.getPage(null);

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
    const customer = customerFor(signature, adultDob, branchId);
    pageStub.resolves([signature]);
    customersStub.resolves(unchecked([customer]));
    usersAggregateStub.resolves([{ userDetail: new ObjectId(customer.id), permission: "manager" }]);
    // The handler's transform renames _id to id and stringifies it before rows reach the caller.
    branchesAggregateStub.resolves([{ id: branchId, name: "Ullern VGS" }]);

    const page = await SignatureGalleryService.getPage(null);

    assert.equal(page.signatures[0]?.branchName, "Ullern VGS");
    assert.equal(page.signatures[0]?.permission, "manager");
  });

  test("skips the branch lookup when no customer has a membership", async ({ assert }) => {
    const signature = makeSignature({ id: 1 });
    pageStub.resolves([signature]);
    customersStub.resolves(unchecked([customerFor(signature)]));

    const page = await SignatureGalleryService.getPage(null);

    assert.isNull(page.signatures[0]?.branchName);
    assert.isFalse(branchesAggregateStub.called);
  });
});
