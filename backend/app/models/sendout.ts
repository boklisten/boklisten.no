import { SendoutSchema } from "#database/schema";
import type { SendoutKind } from "#shared/message-log";

export default class Sendout extends SendoutSchema {
  declare kind: SendoutKind;
}
