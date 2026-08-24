import { test } from "@japa/runner";

import {
  DuplicateCandidateSource,
  findDuplicateCandidatePairs,
} from "#services/user_duplicates_service";

function user(overrides: Partial<DuplicateCandidateSource> & { id: string }) {
  return {
    name: "",
    email: "",
    phone: "",
    address: "",
    postCode: "",
    guardianEmail: "",
    guardianPhone: "",
    ...overrides,
  };
}

test.group("findDuplicateCandidatePairs", () => {
  test("flags two users with the same normalized name", ({ assert }) => {
    const pairs = findDuplicateCandidatePairs([
      user({ id: "a", name: "Ola  Nordmann", email: "ola@example.com" }),
      user({ id: "b", name: "ola nordmann", email: "ola2@example.com" }),
      user({ id: "c", name: "Kari Nordmann" }),
    ]);
    assert.lengthOf(pairs, 1);
    assert.sameMembers([pairs[0]?.a.id, pairs[0]?.b.id], ["a", "b"]);
    assert.include(pairs[0]?.reasons, "Samme navn");
  });

  test("flags same birthday plus same guardian even when names differ", ({ assert }) => {
    const pairs = findDuplicateCandidatePairs([
      user({ id: "a", name: "Ola Nordmann", dob: "2008-05-17", guardianPhone: "+47 900 00 001" }),
      user({ id: "b", name: "Ola Nordman", dob: "2008-05-17", guardianPhone: "90000001" }),
    ]);
    assert.lengthOf(pairs, 1);
    assert.include(pairs[0]?.reasons, "Samme fødselsdato");
    assert.include(pairs[0]?.reasons, "Samme foresatt");
  });

  test("does not flag siblings that only share guardian and address", ({ assert }) => {
    const pairs = findDuplicateCandidatePairs([
      user({
        id: "a",
        name: "Ola Nordmann",
        dob: "2008-05-17",
        address: "Storgata 1",
        postCode: "0181",
        guardianEmail: "mor@example.com",
      }),
      user({
        id: "b",
        name: "Kari Nordmann",
        dob: "2010-01-02",
        address: "Storgata 1",
        postCode: "0181",
        guardianEmail: "mor@example.com",
      }),
    ]);
    assert.lengthOf(pairs, 0);
  });

  test("twins with different names sharing birthday and guardian are flagged", ({ assert }) => {
    // Known false-positive class: handled by the ignore list in the UI
    const pairs = findDuplicateCandidatePairs([
      user({ id: "a", name: "Ola Nordmann", dob: "2008-05-17", guardianEmail: "mor@example.com" }),
      user({ id: "b", name: "Kari Nordmann", dob: "2008-05-17", guardianEmail: "mor@example.com" }),
    ]);
    assert.lengthOf(pairs, 1);
  });

  test("ranks pairs with more matching signals first", ({ assert }) => {
    const pairs = findDuplicateCandidatePairs([
      user({ id: "a", name: "Ola Nordmann" }),
      user({ id: "b", name: "Ola Nordmann" }),
      user({
        id: "c",
        name: "Kari Hansen",
        dob: "2008-01-01",
        address: "Storgata 1",
        postCode: "0181",
      }),
      user({
        id: "d",
        name: "Kari Hansen",
        dob: "2008-01-01",
        address: "Storgata 1",
        postCode: "0181",
      }),
    ]);
    assert.lengthOf(pairs, 2);
    assert.sameMembers([pairs[0]?.a.id, pairs[0]?.b.id], ["c", "d"]);
  });

  test("does not compare users with empty names or birthdays", ({ assert }) => {
    const pairs = findDuplicateCandidatePairs([
      user({ id: "a", name: "" }),
      user({ id: "b", name: "" }),
      user({ id: "c" }),
    ]);
    assert.lengthOf(pairs, 0);
  });

  test("skips blocks larger than the block size cap", ({ assert }) => {
    const manySameName = Array.from({ length: 25 }, (_, index) =>
      user({ id: `user-${index}`, name: "Vanlig Navn" }),
    );
    const pairs = findDuplicateCandidatePairs(manySameName);
    assert.lengthOf(pairs, 0);
  });

  test("reports each pair only once even when multiple blocks match", ({ assert }) => {
    const pairs = findDuplicateCandidatePairs([
      user({ id: "a", name: "Ola Nordmann", dob: "2008-05-17" }),
      user({ id: "b", name: "Ola Nordmann", dob: "2008-05-17" }),
    ]);
    assert.lengthOf(pairs, 1);
  });
});
