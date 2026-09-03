import vine from "@vinejs/vine";

const OBJECT_ID_PATTERN = /^[0-9a-f]{24}$/i;

export const orderBranchUpdateValidator = vine.create(
  vine.object({
    branchId: vine.string().regex(OBJECT_ID_PATTERN),
  }),
);
