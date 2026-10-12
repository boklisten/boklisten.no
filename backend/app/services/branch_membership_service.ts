import BadRequestException from "#exceptions/bad_request_exception";
import Branch from "#models/branch";
import User from "#models/user";
import { BranchScope } from "#services/branch_scope";
import type { MemberScope } from "#shared/branch-members";

const DEFAULT_PAGE_SIZE = 50;
const ID_LENGTH = 24;

interface MemberRow {
  id: string;
  name: string;
  yearOfBirth: string | null;
  branchMembershipId: string;
}

interface MembersPage {
  members: MemberRow[];
  /** Continues after this page's last row, or null when there is no page after it. */
  nextCursor: string | null;
  /** Members of the node itself and of the branches below it, whatever the page lists. */
  counts: { direct: number; indirect: number };
}

/**
 * The cursor carries the last row's sort key itself (its id, then its name as it was sorted), so
 * the next page is right even when that member has since been renamed, moved or deleted.
 */
function encodeCursor(member: MemberRow): string {
  return `${member.id}${member.name}`;
}

function decodeCursor(cursor: string): { id: string; name: string } {
  return { id: cursor.slice(0, ID_LENGTH), name: cursor.slice(ID_LENGTH) };
}

export const BranchMembershipService = {
  /**
   * One page of the members of a node, by name: the node's own members (`direct`), or those of
   * the branches below it (`descendants`). Membership is the whole rule here (Adrian,
   * 2026-10-12): a privatist who ordered at the school is not one of its members. Members who
   * share a name are ordered by id, so a page never repeats a row and never skips one.
   */
  async getPage(
    branchId: string,
    {
      scope,
      cursor,
      limit = DEFAULT_PAGE_SIZE,
    }: { scope: MemberScope; cursor?: string; limit?: number },
  ): Promise<MembersPage> {
    const subtreeIds = await BranchScope.subtreeIds(branchId);
    const query = User.membersOf(scope === "direct" ? [branchId] : subtreeIds.slice(1))
      .select("id", "name", "dob", "branchMembershipId")
      .orderByRaw("coalesce(name, ''), id")
      .limit(limit + 1);
    if (cursor) {
      const after = decodeCursor(cursor);
      void query.whereRaw("(coalesce(name, ''), id) > (?, ?)", [after.name, after.id]);
    }
    const [rows, directCount, indirectCount] = await Promise.all([
      query,
      User.countMembersOf([branchId]),
      User.countMembersOf(subtreeIds.slice(1)),
    ]);
    const members = rows.slice(0, limit).map((member) => ({
      id: member.id,
      name: member.name ?? "",
      yearOfBirth: member.dob ? String(member.dob.year) : null,
      branchMembershipId: member.branchMembershipId,
    }));
    const last = members.at(-1);
    return {
      members,
      nextCursor: rows.length > limit && last ? encodeCursor(last) : null,
      counts: { direct: directCount, indirect: indirectCount },
    };
  },

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
