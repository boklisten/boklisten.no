import type { HttpContext } from "@adonisjs/core/http";
import db from "@adonisjs/lucid/services/db";

import {
  questionsAndAnswersOrderValidator,
  questionsAndAnswersValidator,
} from "#validators/questions_and_answers_validator";
import QuestionAndAnswer from "#models/question_and_answer";
import QuestionAndAnswerTransformer from "#transformers/question_and_answer_transformer";

export default class QuestionsAndAnswersController {
  async index({ serialize }: HttpContext) {
    return serialize(
      QuestionAndAnswerTransformer.transform(
        await QuestionAndAnswer.query().orderBy("position", "asc"),
      ),
    );
  }

  async store(ctx: HttpContext) {
    const { question, answer } = await ctx.request.validateUsing(questionsAndAnswersValidator);
    const last = await QuestionAndAnswer.query().orderBy("position", "desc").first();
    await QuestionAndAnswer.create({ question, answer, position: (last?.position ?? 0) + 1 });
  }

  async updateOrder(ctx: HttpContext) {
    const { ids } = await ctx.request.validateUsing(questionsAndAnswersOrderValidator);
    await db.rawQuery(
      `UPDATE question_and_answers AS qa SET position = ordered.position - 1
       FROM unnest(?::int[]) WITH ORDINALITY AS ordered(id, position)
       WHERE qa.id = ordered.id`,
      [ids],
    );
  }

  async update(ctx: HttpContext) {
    const { question, answer } = await ctx.request.validateUsing(questionsAndAnswersValidator);
    const questionAndAnswer = await QuestionAndAnswer.findOrFail(ctx.request.param("id"));
    await questionAndAnswer.merge({ question, answer }).save();
  }

  async destroy(ctx: HttpContext) {
    const questionAndAnswer = await QuestionAndAnswer.findOrFail(ctx.request.param("id"));
    await questionAndAnswer.delete();
  }
}
