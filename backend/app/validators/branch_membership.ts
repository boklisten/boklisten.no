import vine from "@vinejs/vine";

export const updateBranchMembershipValidator = vine.create(
  vine.object({
    detailsId: vine.string(),
    branchMembership: vine.string().nullable(),
  }),
);
