import vine from "@vinejs/vine";

/** 8 digits (older labels) or 12 alphanumeric characters (printed from Unike IDer). */
export const BLID_PATTERN = /^[\dA-Za-z]{12}$|^\d{8}$/;
export const ISBN_PATTERN = /^\d{13}$/;

export const blidRegistrationValidator = vine.create(
  vine.object({
    isbn: vine.string().trim().regex(ISBN_PATTERN),
    blids: vine.array(vine.string().trim().regex(BLID_PATTERN)).minLength(1),
  }),
);
