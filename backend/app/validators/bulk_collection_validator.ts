import vine from "@vinejs/vine";

export const bulkCollectionCollectValidator = vine.create({
  customerItemIds: vine.array(vine.string()).minLength(1),
});

export const bulkCollectionUnlockValidator = vine.create({
  customerItemId: vine.string(),
});
