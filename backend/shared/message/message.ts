import { BlDocument } from "#shared/bl-document";
import { MessageReceiptInfo } from "#shared/message/message-info/message-receipt-info";
import { MessageReminderInfo } from "#shared/message/message-info/message-reminder-info";
import { MessageMethod } from "#shared/message/message-method/message-method";
import { SendgridEvent } from "#shared/message/message-sendgrid-event/message-sendgrid-event";
import { MessageSubtype } from "#shared/message/message-subtype/message-subtype";
import { MessageType } from "#shared/message/message-type/message-type";
import { TextBlock } from "#shared/text-block";

/*
 * A message is something that is sent to a customer
 * for example a reminder about delivering items.
 * It can be a email, direct message, sms, or all.
 */
export interface Message extends BlDocument {
  // what type of message, ex 'reminder', 'alert', 'direct'
  messageType: MessageType;
  // what type of subtype, ex: 'partly-payment', 'rent'
  messageSubtype: MessageSubtype;
  // what type of method should be used to send message ex: 'email', 'sms'
  // ("all" is no longer written, but exists on historic documents)
  messageMethod: MessageMethod | "all";
  // the id of the customer
  customerId: string;
  // if there are more than one message of this type and subtype
  sequenceNumber?: number;
  // if employee should be known to customer, set it here
  employeeId?: string;
  // info based on the specific message type
  info?: MessageReminderInfo | MessageReceiptInfo;
  events?: SendgridEvent[]; // events for this message, can be sendgrid events
  smsEvents?: unknown[]; // sms events for this message
  htmlContent?: string; // html content for generic messages
  customContent?: string; // custom content to use when not using sequence number
  subject?: string; // subject for generic html
  // the message can be supported with text blocks
  textBlocks?: TextBlock[];
}
