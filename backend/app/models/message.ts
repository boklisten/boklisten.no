import { randomUUID } from "node:crypto";

import { beforeCreate, belongsTo, hasMany } from "@adonisjs/lucid/orm";
import type { BelongsTo, HasMany } from "@adonisjs/lucid/types/relations";

import MessageEvent from "#models/message_event";
import Sendout from "#models/sendout";
import { MessageSchema } from "#database/schema";
import { MessageChannel, MessageStatus, MessageType } from "#shared/message-log";

export default class Message extends MessageSchema {
  static override selfAssignPrimaryKey = true;

  declare channel: MessageChannel;
  declare messageType: MessageType;
  declare status: MessageStatus;
  declare templateData: Record<string, unknown> | null;

  @beforeCreate()
  static assignUuid(message: Message) {
    message.id ||= randomUUID();
  }

  @hasMany(() => MessageEvent, { foreignKey: "messageId" })
  declare events: HasMany<typeof MessageEvent>;

  @belongsTo(() => Sendout, { foreignKey: "sendoutId" })
  declare sendout: BelongsTo<typeof Sendout>;
}
