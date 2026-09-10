import vine from "@vinejs/vine";

const itemFields = {
  title: vine.string().trim().minLength(1),
  isbn: vine.number().withoutDecimals().positive(),
  subject: vine.string().trim().minLength(1),
  year: vine.number().withoutDecimals().min(1900).max(2100),
  price: vine.number().min(0),
  weight: vine.number().min(0),
  distributor: vine.string().trim().minLength(1),
  discount: vine.number().min(0).max(1),
  publisher: vine.string().trim().minLength(1),
  active: vine.boolean(),
  buyback: vine.boolean(),
};

export const createItemValidator = vine.create(vine.object(itemFields));

/** A spreadsheet row carries the id it was downloaded with; a row without one is a new book or matched by ISBN. */
export const bulkUpsertItemsValidator = vine.create(
  vine.object({
    items: vine
      .array(vine.object({ id: vine.string().trim().minLength(1).optional(), ...itemFields }))
      .minLength(1),
  }),
);

export const updateItemValidator = vine.create(
  vine.object({
    title: itemFields.title.optional(),
    isbn: itemFields.isbn.optional(),
    subject: itemFields.subject.optional(),
    year: itemFields.year.optional(),
    price: itemFields.price.optional(),
    weight: itemFields.weight.optional(),
    distributor: itemFields.distributor.optional(),
    discount: itemFields.discount.optional(),
    publisher: itemFields.publisher.optional(),
    active: itemFields.active.optional(),
    buyback: itemFields.buyback.optional(),
  }),
);
