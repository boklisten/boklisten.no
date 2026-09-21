import type { HttpContext } from "@adonisjs/core/http";
import { DateTime } from "luxon";
import { ObjectId } from "mongodb";

import Item from "#models/item";
import User from "#models/user";
import { deadlineWindow } from "#services/deadline_window";
import DispatchService from "#services/dispatch_service";
import type { MessageLogContext } from "#services/message_log_service";
import { MessageLogService } from "#services/message_log_service";
import { StorageService } from "#services/storage_service";
import { reminderValidator } from "#validators/reminder";

interface ReminderCustomer {
  customerDetailsId: string;
  name: string;
  customerItems: {
    title: string;
    deadline: string;
    blid: string;
  }[];
  phone: string | null;
  email: string;
  guardian: { phone: string | null; email: string | null };
}

/** The aggregation's output: the customer is a bare id and books still carry the item id; both are joined from Postgres. */
interface RemindedCustomerRow {
  customerDetailsId: string;
  customerItems: { blid: string; item: ObjectId; deadline: string }[];
}

async function aggregateCustomersToRemind(
  customerItemType: "rent" | "partly-payment",
  branchIDs: string[],
  deadlineISO: string,
): Promise<ReminderCustomer[]> {
  const { after, before } = deadlineWindow(new Date(deadlineISO));
  const rows = await StorageService.CustomerItems.aggregate<RemindedCustomerRow>([
    {
      $match: {
        returned: false,
        buyout: false,
        cancel: false,
        type: customerItemType,
        "handoutInfo.handoutById": {
          $in: branchIDs.map((branchID) => new ObjectId(branchID)),
        },
        deadline: { $gt: after, $lt: before },
      },
    },
    {
      $group: {
        _id: "$customer",
        customerItems: {
          $push: {
            blid: "$blid",
            item: "$item",
            deadline: "$deadline",
          },
        },
      },
    },
    {
      $project: {
        _id: 0,
        customerDetailsId: { $toString: "$_id" },
        customerItems: 1,
      },
    },
  ]);
  const [titles, customers] = await Promise.all([
    Item.titlesByIds(
      rows.flatMap((row) => row.customerItems.map((customerItem) => String(customerItem.item))),
    ),
    User.byIds(rows.map((row) => row.customerDetailsId)),
  ]);
  // A book whose title is gone from the catalogue is left out, and so is a customer who has been
  // deleted or is left with no books, as the inner joins did before the data moved to Postgres.
  return rows.flatMap((row) => {
    const customer = customers.get(row.customerDetailsId);
    if (!customer) {
      return [];
    }
    const customerItems = row.customerItems.flatMap(({ item, ...customerItem }) => {
      const title = titles.get(String(item));
      return title === undefined ? [] : [{ ...customerItem, title }];
    });
    if (customerItems.length === 0) {
      return [];
    }
    return [
      {
        customerDetailsId: row.customerDetailsId,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        guardian: { phone: customer.guardianPhone, email: customer.guardianEmail },
        customerItems,
      },
    ];
  });
}

/**
 * The deadline as it should read in an email. Deadlines are picked as calendar dates and stored
 * as midnight, Norwegian or UTC depending on who wrote them; both read as the intended day once
 * formatted in Norwegian local time (the app's default zone).
 */
function formatDeadline(deadline: string) {
  return DateTime.fromJSDate(new Date(deadline)).toFormat("dd/MM/yyyy");
}

async function sendReminderEmail(
  emailTemplateId: string,
  customers: ReminderCustomer[],
  target: "primary" | "guardian",
  context: MessageLogContext,
) {
  const filteredCustomers =
    target === "primary"
      ? customers
      : customers.filter((customer) => (customer.guardian.email?.length ?? 0) > 0);

  if (filteredCustomers.length === 0) {
    return { success: true };
  }
  return DispatchService.sendUserProvidedEmailTemplate({
    templateId: emailTemplateId,
    context,
    recipients: filteredCustomers.map((customer) => ({
      to: target === "primary" ? customer.email : (customer.guardian.email ?? ""),
      regardingCustomerDetailsId: customer.customerDetailsId,
      dynamicTemplateData: {
        name: customer.name?.split(" ")?.[0] ?? "",
        items: customer.customerItems.map((customerItem) => ({
          ...customerItem,
          deadline: formatDeadline(customerItem.deadline),
        })),
      },
    })),
  });
}

export default class RemindersController {
  async countRecipients(ctx: HttpContext) {
    const { deadlineISO, customerItemType, branchIDs } =
      await ctx.request.validateUsing(reminderValidator);
    const customers = await aggregateCustomersToRemind(customerItemType, branchIDs, deadlineISO);
    return { recipientCount: customers.length };
  }

  async send(ctx: HttpContext) {
    const { detailsId } = ctx.authUser;

    const { deadlineISO, customerItemType, branchIDs, emailTemplateId, smsText } =
      await ctx.request.validateUsing(reminderValidator);

    const customers = await aggregateCustomersToRemind(customerItemType, branchIDs, deadlineISO);

    const sendout = await MessageLogService.createSendout({
      kind: "reminder",
      name: `Påminnelse ${customerItemType === "rent" ? "lån" : "avbetaling"}, frist ${formatDeadline(deadlineISO)}`,
      initiatedByDetailsId: detailsId,
    });
    const context: MessageLogContext = { messageType: "reminder", sendoutId: sendout?.id };

    if (emailTemplateId) {
      const { success: successPrimaryEmail } = await sendReminderEmail(
        emailTemplateId,
        customers,
        "primary",
        context,
      );
      if (!successPrimaryEmail) {
        return ctx.response.internalServerError();
      }

      if (customerItemType === "rent") {
        const { success: successGuardianEmail } = await sendReminderEmail(
          emailTemplateId,
          customers,
          "guardian",
          context,
        );
        if (!successGuardianEmail) {
          return ctx.response.internalServerError();
        }
      }
    }

    if (smsText) {
      await DispatchService.sendReminderSms(
        customers.flatMap((customer) =>
          customer.phone === null
            ? []
            : [{ to: customer.phone, regardingCustomerDetailsId: customer.customerDetailsId }],
        ),
        smsText,
        context,
      );
      if (customerItemType === "rent") {
        await DispatchService.sendReminderSms(
          customers
            .filter((customer) => (customer.guardian.phone?.length ?? 0) > 0)
            .map((customer) => ({
              to: customer.guardian.phone ?? "",
              regardingCustomerDetailsId: customer.customerDetailsId,
            })),
          smsText,
          context,
        );
      }
    }

    return { success: true };
  }
}
