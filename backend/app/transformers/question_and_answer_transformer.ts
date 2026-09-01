import { BaseTransformer } from "@adonisjs/core/transformers";
import type QuestionAndAnswer from "#models/question_and_answer";

export default class QuestionAndAnswerTransformer extends BaseTransformer<QuestionAndAnswer> {
  toObject() {
    return {
      id: this.resource.id.toString(),
      ...this.pick(this.resource, ["question", "answer"]),
    };
  }
}
