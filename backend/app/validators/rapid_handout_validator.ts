import vine from "@vinejs/vine";

export const rapidHandoutValidator = vine.create({
  blid: vine.string(),
  customerId: vine.string(),
  /**
   * When true, hand out even if the book belongs to a (non-locked) UserMatch where the customer is
   * supposed to receive it from another student. Set after the employee confirms the warning.
   */
  force: vine.boolean().optional(),
});
