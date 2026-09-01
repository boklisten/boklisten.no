import { MessageEventSchema } from "#database/schema";
import type { MessageEventSource } from "#shared/message-log";

export default class MessageEvent extends MessageEventSchema {
  declare source: MessageEventSource;
  declare payload: Record<string, unknown> | null;
}
