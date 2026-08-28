import logger from "@adonisjs/core/services/logger";

import { StorageService } from "#services/storage_service";
import { BlError } from "#shared/bl-error";
import { BlapiResponse } from "#shared/blapi-response";
import { Message } from "#shared/message/message";
import { SendgridEvent } from "#shared/message/message-sendgrid-event/message-sendgrid-event";
import { BlApiRequest } from "#types/bl-api-request";
import { Operation } from "#types/operation";

export class SendgridEventOperation implements Operation {
  public async run(blApiRequest: BlApiRequest): Promise<BlapiResponse> {
    if (!blApiRequest.data || Object.keys(blApiRequest.data).length === 0) {
      throw new BlError("blApiRequest.data is empty").code(701);
    }

    if (!Array.isArray(blApiRequest.data)) {
      throw new BlError("blApiRequest.data is not an array").code(701);
    }

    for (const sendgridEvent of blApiRequest.data) {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- webhook payload from SendGrid; trusted as-is like the rest of this legacy operation
      await this.parseSendgridEvent(sendgridEvent as SendgridEvent);
    }

    return { documentName: "success", data: [] };
  }

  private async parseSendgridEvent(sendgridEvent: SendgridEvent) {
    // @ts-expect-error fixme: auto ignored
    const blMessageId = sendgridEvent["bl_message_id"];

    // @ts-expect-error fixme: auto ignored
    const messageType = sendgridEvent["bl_message_type"];

    if (!blMessageId) {
      // default is that the message dont have a blMessageId
      logger.debug(`sendgrid event did not have a bl_message_id`);
      return;
    }

    if (messageType !== "reminder") {
      // as of now, we only whant to collect the reminder emails
      logger.debug(`sendgrid event did not have supported bl_message_type`);
      return;
    }

    try {
      const message = await StorageService.Messages.get(blMessageId);
      await this.updateMessageWithSendgridEvent(message, sendgridEvent);
    } catch (error) {
      logger.warn(`could not update sendgrid event ${error}`);
      // if we dont find the message, there is no worries in not handling it
      // this is just for logging anyway, and we can handle some losses
    }
  }

  private async updateMessageWithSendgridEvent(
    message: Message,
    sendgridEvent: SendgridEvent,
  ): Promise<boolean> {
    const newSendgridEvents = message.events && message.events.length > 0 ? message.events : [];

    newSendgridEvents.push(sendgridEvent);

    await StorageService.Messages.update(message.id, {
      events: newSendgridEvents,
    });

    logger.trace(
      `updated message "${message.id}" with sendgrid event: "${sendgridEvent["event"]}"`,
    );

    return true;
  }
}
