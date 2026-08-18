import vine from "@vinejs/vine";

export const branchSubjectValidator = vine.create(
  vine.object({
    name: vine.string().trim().minLength(1),
    externalName: vine.string().trim().minLength(1),
    books: vine.array(
      vine.object({
        itemId: vine.string(),
        rent: vine.boolean(),
        partlyPayment: vine.boolean(),
        buy: vine.boolean(),
        rentAtBranch: vine.boolean(),
        partlyPaymentAtBranch: vine.boolean(),
        buyAtBranch: vine.boolean(),
      }),
    ),
  }),
);
