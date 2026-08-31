import type { HttpContext } from "@adonisjs/core/http";
import { DateTime } from "luxon";
import { ObjectId } from "mongodb";

import { deadlineWindow } from "#services/deadline_window";
import DispatchService from "#services/dispatch_service";
import { PermissionService } from "#services/permission_service";
import { StorageService } from "#services/storage_service";
import { reminderValidator } from "#validators/reminder";

interface ReminderCustomer {
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

async function aggregateCustomersToRemind(
  customerItemType: "rent" | "partly-payment",
  branchIDs: string[],
  deadlineISO: string,
) {
  const { after, before } = deadlineWindow(new Date(deadlineISO));
  return await StorageService.CustomerItems.aggregate<ReminderCustomer>([
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
      $lookup: {
        from: "items",
        localField: "item",
        foreignField: "_id",
        as: "item",
      },
    },
    {
      $unwind: {
        path: "$item",
      },
    },
    {
      $group: {
        _id: "$customer",
        customerItems: {
          $push: {
            blid: "$blid",
            title: "$item.title",
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
) {
  const filteredCustomers =
    target === "primary"
      ? customers
      : customers.filter((customer) => (customer.guardian.email?.length ?? 0) > 0);

  if (filteredCustomers.length === 0) {
    return { success: true };
  }
  return await DispatchService.sendUserProvidedEmailTemplate({
    templateId: emailTemplateId,
    recipients: filteredCustomers.map((customer) => ({
      to: target === "primary" ? customer.email : (customer.guardian.email ?? ""),
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
    PermissionService.adminOrFail(ctx);

    const { deadlineISO, customerItemType, branchIDs } =
      await ctx.request.validateUsing(reminderValidator);
    const customers = await aggregateCustomersToRemind(customerItemType, branchIDs, deadlineISO);
    return { recipientCount: customers.length };
  }

  async remind(ctx: HttpContext) {
    PermissionService.adminOrFail(ctx);

    const { deadlineISO, customerItemType, branchIDs, emailTemplateId, smsText } =
      await ctx.request.validateUsing(reminderValidator);

    const customers = await aggregateCustomersToRemind(customerItemType, branchIDs, deadlineISO);

    if (emailTemplateId) {
      const { success: successPrimaryEmail } = await sendReminderEmail(
        emailTemplateId,
        customers,
        "primary",
      );
      if (!successPrimaryEmail) {
        return ctx.response.internalServerError();
      }

      if (customerItemType === "rent") {
        const { success: successGuardianEmail } = await sendReminderEmail(
          emailTemplateId,
          customers,
          "guardian",
        );
        if (!successGuardianEmail) {
          return ctx.response.internalServerError();
        }
      }
    }

    if (smsText) {
      await DispatchService.sendReminderSms(
        customers.map((customer) => customer.phone),
        smsText,
      );
      if (customerItemType === "rent") {
        await DispatchService.sendReminderSms(
          customers
            .filter((customer) => (customer.guardian.phone?.length ?? 0) > 0)
            .map((customer) => customer.guardian.phone ?? ""),
          smsText,
        );
      }
    }

    return { success: true };
  }
}
