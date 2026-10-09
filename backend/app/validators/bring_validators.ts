import vine from "@vinejs/vine";

export const bringPostalCodeResponseValidator = vine.create(
  vine.object({
    postal_codes: vine.array(
      vine.object({
        city: vine.string(),
        postal_code: vine.string(),
      }),
    ),
  }),
);
