import vine from "@vinejs/vine";

export const customerItemsReportValidator = vine.create({
  branchFilter: vine.array(vine.string()).optional(),
  createdAfter: vine.string().optional(),
  createdBefore: vine.string().optional(),
  deadlineAfter: vine.string().optional(),
  deadlineBefore: vine.string().optional(),
});

export const ordersReportValidator = vine.create({
  branchFilter: vine.array(vine.string()).optional(),
  createdAfter: vine.string().optional(),
  createdBefore: vine.string().optional(),
});

export const paymentsReportValidator = vine.create({
  branchFilter: vine.array(vine.string()).optional(),
  createdAfter: vine.string().optional(),
  createdBefore: vine.string().optional(),
});

export const userDetailsReportValidator = vine.create({
  branchFilter: vine.array(vine.string()).optional(),
});
