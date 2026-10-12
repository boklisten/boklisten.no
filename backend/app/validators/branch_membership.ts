import vine from "@vinejs/vine";

import { MEMBER_SCOPES } from "#shared/branch-members";
import { objectIdField } from "#validators/common/fields";

export const updateBranchMembershipValidator = vine.create(
  vine.object({
    userId: vine.string(),
    branchMembership: objectIdField.clone(),
  }),
);

export const branchMembersPageValidator = vine.create(
  vine.object({
    /** The node's own members, or those of the branches below it. */
    scope: vine.enum(MEMBER_SCOPES),
    /** The previous page's `nextCursor`; empty or missing means the first page. */
    cursor: vine.string().optional(),
    limit: vine.number().withoutDecimals().min(1).max(200).optional(),
  }),
);
