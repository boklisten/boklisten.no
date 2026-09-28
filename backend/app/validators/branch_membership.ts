import vine from "@vinejs/vine";

export const updateBranchMembershipValidator = vine.create(
  vine.object({
    userId: vine.string(),
    branchMembership: vine.string().nullable(),
  }),
);
