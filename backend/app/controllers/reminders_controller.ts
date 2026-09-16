import type { HttpContext } from "@adonisjs/core/http";
import { DateTime } from "luxon";
import { ObjectId } from "mongodb";

import Item from "#models/item";
import { deadlineWindow } from "#services/deadline_window";
import DispatchService from "#services/dispatch_service";
import type { MessageLogContext } from "#services/message_log_service";
import { MessageLogService } from "#services/message_log_service";
import { StorageService } from "#services/storage_service";
import { reminderValidator } from "#validators/reminder";

interface ReminderCustomer {
  customerDetailsId: string;
  name: string;
  dob: Date;
  customerItems: {
    title: string;
    deadline: string;
    blid: string;
  }[];
  phone: string;
  email: string;
  guardian: { phone: string | undefined; email: string | undefined };
}

/** The aggregation's output: books still carry the item id, titles are joined from Postgres. */
type RemindedCustomerRow = Omit<ReminderCustomer, "customerItems"> & {
  customerItems: { blid: string; item: ObjectId; deadline: string }[];
};

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
      $lookup: {
        from: "userdetails",
        localField: "_id",
        foreignField: "_id",
        as: "customer",
      },
    },
    {
      $unwind: {
        path: "$customer",
      },
    },
    {
      $project: {
        customerDetailsId: { $toString: "$_id" },
        name: "$customer.name",
        phone: "$customer.phone",
        dob: "$customer.dob",
        email: "$customer.email",
        guardian: {
          phone: "$customer.guardian.phone",
          email: "$customer.guardian.email",
        },
        customerItems: 1,
      },
    },
  ]);
  const titles = await Item.titlesByIds(
    rows.flatMap((row) => row.customerItems.map((customerItem) => String(customerItem.item))),
  );
  // A book whose title is gone from the catalogue is left out, and so is a customer left with no
  // books, as the inner join did before the catalogue moved to Postgres.
  return rows.flatMap((row) => {
    const customerItems = row.customerItems.flatMap(({ item, ...customerItem }) => {
      const title = titles.get(String(item));
      return title === undefined ? [] : [{ ...customerItem, title }];
    });
    return customerItems.length === 0 ? [] : [{ ...row, customerItems }];
  });
}

/**
 * The deadline as it should read in an email.
 *
 * fixme: the added day compensates for a time zone issue — deadlines are picked as calendar dates
 * but stored as instants, so one written in a zone ahead of the server sits late on the previous
 * day (the same drift `deadlineWindow` pads around). Formatting the stored instant in the zone it
 * was written in would fix this properly, but that zone is not recorded.
 */
function formatDeadline(deadline: string) {
  return DateTime.fromJSDate(new Date(deadline)).plus({ days: 1 }).toFormat("dd/MM/yyyy");
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
        customers.map((customer) => ({
          to: customer.phone,
          regardingCustomerDetailsId: customer.customerDetailsId,
        })),
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
