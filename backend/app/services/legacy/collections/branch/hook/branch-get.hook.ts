import { Hook } from "#services/legacy/hook";
import { PermissionService } from "#services/permission_service";
import type { AccessToken } from "#shared/access-token";
import type { Branch } from "#shared/branch";

export class BranchGetHook extends Hook {
  public override after(branches: Branch[], accessToken: AccessToken): Promise<Branch[]> {
    for (const branch of branches) {
      this.resolveBranchItems(branch, accessToken);
    }

    return Promise.resolve(branches);
  }

  /** Admins always see the branch items; employees only when they are live at the branch. */
  private resolveBranchItems(branch: Branch, accessToken: AccessToken) {
    if (
      branch.isBranchItemsLive &&
      !branch.isBranchItemsLive.atBranch &&
      !PermissionService.isPermissionEqualOrOver(accessToken.permission, "admin")
    ) {
      branch.branchItems = [];
    }
  }
}
