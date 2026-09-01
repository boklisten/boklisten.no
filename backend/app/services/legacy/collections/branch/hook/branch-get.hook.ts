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

  private resolveBranchItems(branch: Branch, accessToken: AccessToken) {
    if (branch.isBranchItemsLive !== undefined && branch.isBranchItemsLive !== null) {
      if (accessToken) {
        if (PermissionService.isPermissionEqualOrOver(accessToken.permission, "admin")) {
          return; // admin should always get the branchItems
        }

        // have a user
        if (PermissionService.isPermissionEqualOrOver(accessToken.permission, "employee")) {
          if (!branch.isBranchItemsLive.atBranch) {
            branch.branchItems = [];
          }
        } else if (!branch.isBranchItemsLive.online) {
          // user is customer and must be "online" (bl-web)
          branch.branchItems = [];
        }
      } else if (!branch.isBranchItemsLive.online) {
        // no user found, must be "online" (bl-web); should not show branchItems
        branch.branchItems = [];
      }
    }
  }
}
