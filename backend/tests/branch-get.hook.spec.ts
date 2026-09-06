import { test } from "@japa/runner";

import { BranchGetHook } from "#services/legacy/collections/branch/hook/branch-get.hook";
import type { AccessToken } from "#shared/access-token";
import { mock } from "#tests/test-doubles";

const branchGetHook = new BranchGetHook();

test.group("BranchGetHook.after", async () => {
  test("should return empty branchItems array for an employee when 'atBranch' in 'isBranchItemsLive' is false", async ({
    assert,
  }) => {
    const branch = {
      id: "branch1",
      name: "some branch",
      type: "privatist",
      branchItems: ["branchItem1", "branchItem2"],
      isBranchItemsLive: {
        online: false,
        atBranch: false,
      },
      location: {
        region: "unknown",
      },
    };

    const expectedResult = {
      id: "branch1",
      name: "some branch",
      type: "privatist",
      branchItems: [],
      isBranchItemsLive: {
        online: false,
        atBranch: false,
      },
      location: {
        region: "unknown",
      },
    };

    assert.deepEqual(
      await branchGetHook.after([branch], mock<AccessToken>({ permission: "employee" })),
      [expectedResult],
    );
  });

  test("should return branchItems array for an employee when 'atBranch' is true on 'isBranchItemsLive'", async ({
    assert,
  }) => {
    const branch = {
      id: "branch1",
      name: "some branch",
      type: "privatist",
      branchItems: ["branchItem1", "branchItem2"],
      isBranchItemsLive: {
        online: true,
        atBranch: true,
      },
      location: {
        region: "unknown",
      },
    };

    const expectedResult = {
      id: "branch1",
      name: "some branch",
      type: "privatist",
      branchItems: ["branchItem1", "branchItem2"],
      isBranchItemsLive: {
        online: true,
        atBranch: true,
      },
      location: {
        region: "unknown",
      },
    };

    assert.deepEqual(
      await branchGetHook.after([branch], mock<AccessToken>({ permission: "employee" })),
      [expectedResult],
    );
  });

  test("should return branchItems array if 'online' and 'atBranch' is false on 'isBranchItemsLive' and 'accessToken.permission' is admin or above", async ({
    assert,
  }) => {
    const branch = {
      id: "branch1",
      name: "some branch",
      type: "privatist",
      branchItems: ["branchItem1", "branchItem2"],
      isBranchItemsLive: {
        online: false,
        atBranch: false,
      },
      location: {
        region: "unknown",
      },
    };

    const accessToken = mock<AccessToken>({
      permission: "admin",
    });

    const expectedResult = {
      id: "branch1",
      name: "some branch",
      type: "privatist",
      branchItems: ["branchItem1", "branchItem2"],
      isBranchItemsLive: {
        online: false,
        atBranch: false,
      },
      location: {
        region: "unknown",
      },
    };

    assert.deepEqual(await branchGetHook.after([branch], accessToken), [expectedResult]);
  });
});
