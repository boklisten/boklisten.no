import vine from "@vinejs/vine";

import { objectIdField } from "#validators/common/fields";

export const updateBranchMembershipValidator = vine.create(
  vine.object({
    userId: vine.string(),
    branchMembership: objectIdField.clone(),
  }),
);
