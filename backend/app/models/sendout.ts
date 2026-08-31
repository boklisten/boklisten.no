import { SendoutSchema } from "#database/schema";
import { SendoutKind } from "#shared/message-log";

export default class Sendout extends SendoutSchema {
  declare kind: SendoutKind;
}
