import { test } from "@japa/runner";

import { PermissionService } from "#services/permission_service";
import type { BlDocument } from "#shared/bl-document";

test.group("PermissionSerivice", async () => {
  test("should return true if document.user.id is the same as userId even if UserPermission is not correct", async ({
    assert,
  }) => {
    const userId = "aabc";
    const doc: BlDocument = {
      id: "doc1",
      user: { id: userId, permission: "admin" },
    };

    // oxlint-disable-next-line no-unused-expressions
    assert.isTrue(PermissionService.haveRestrictedDocumentPermission(userId, "customer", doc));
  });

  test("should return false if userId is not equal to document.user.id and UserPermission is not valid", async ({
    assert,
  }) => {
    const userId = "abc";
    const doc: BlDocument = {
      id: "doc1",
      user: { id: "123", permission: "admin" },
    };

    // oxlint-disable-next-line no-unused-expressions
    assert.isFalse(PermissionService.haveRestrictedDocumentPermission(userId, "employee", doc));
  });

  test("should return true if userId is not equal to document.user.id but UserPermission is over the document.user.permission", async ({
    assert,
  }) => {
    const userId = "abc";
    const doc: BlDocument = {
      id: "123",
      user: { id: "123", permission: "employee" },
    };

    // oxlint-disable-next-line no-unused-expressions
    assert.isTrue(PermissionService.haveRestrictedDocumentPermission(userId, "admin", doc));
  });
});
