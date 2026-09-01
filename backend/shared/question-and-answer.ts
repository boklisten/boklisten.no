import type { BlDocument } from "#shared/bl-document";

export interface QuestionAndAnswer extends BlDocument {
  question: string;
  answer: string;
}
