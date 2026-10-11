import BadRequestException from "#exceptions/bad_request_exception";
import Branch from "#models/branch";
import User from "#models/user";

export const BranchMembershipService = {
  /**
   * Takes a branch's members off it: the direct members, or everyone in the branches below. They
   * become members of the root, "no school". The root itself has nowhere to move people to.
   */
  async moveMembersToRoot(branchId: string, scope: "direct" | "indirect"): Promise<void> {
    const root = await Branch.root();
    if (branchId === root.id) {
      throw new BadRequestException("Medlemmene av Alle filialer kan ikke flyttes noe sted");
    }
    const branchIds = scope === "direct" ? [branchId] : await Branch.descendantIds(branchId);
    if (branchIds.length > 0) {
      await User.membersOf(branchIds).update({ branchMembershipId: root.id });
    }
  },
};
