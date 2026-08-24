import vine from "@vinejs/vine";

export const rapidHandoutValidator = vine.create({
  blid: vine.string(),
  customerId: vine.string(),
  /**
   * When true, hand out even if the book belongs to a handover where the customer is supposed to
   * receive it from another student. Set after the employee confirms the warning.
   */
  force: vine.boolean().optional(),
  /**
   * Set together after the employee confirms handing out a book the customer never ordered:
   * the branch whose rent period sets the deadline, and the picked deadline itself, which must
   * match one of that branch's future rent periods.
   */
  branchId: vine.string().optional(),
  deadline: vine.date({ formats: ["iso8601"] }).optional(),
});
