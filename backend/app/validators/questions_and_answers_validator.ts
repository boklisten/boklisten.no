import vine from "@vinejs/vine";

export const questionsAndAnswersValidator = vine.create(
  vine.object({
    question: vine.string(),
    answer: vine.string(),
  }),
);

export const questionsAndAnswersOrderValidator = vine.create(
  vine.object({
    ids: vine.array(vine.number()),
  }),
);
