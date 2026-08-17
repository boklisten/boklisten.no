import vine from "@vinejs/vine";

export const subjectChoicesValidator = vine.create({
  rows: vine
    .array(
      vine.object({
        name: vine.string().trim().minLength(1),
        localName: vine.string().trim().minLength(1),
        subject: vine.string().trim().minLength(1),
        deadline: vine.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      }),
    )
    .minLength(1),
});
