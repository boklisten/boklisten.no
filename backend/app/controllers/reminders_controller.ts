import type { HttpContext } from "@adonisjs/core/http";
import db from "@adonisjs/lucid/services/db";
import { DateTime } from "luxon";

import CustomerItem from "#models/customer_item";
import DispatchService from "#services/dispatch_service";
import type { MessageLogContext } from "#services/message_log_service";
import { MessageLogService } from "#services/message_log_service";
import { reminderValidator } from "#validators/reminder";

interface ReminderCustomer {
  customerId: string;
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

interface ReminderFilter {
  customerItemType: "rent" | "partly-payment";
  branchIDs: string[];
  /** `YYYY-MM-DD`. */
  deadline: string;
}

/** The active books of the given type due on the deadline at the branches. */
function booksToRemind({ customerItemType, branchIDs, deadline }: ReminderFilter) {
  return CustomerItem.whereActive(db.from("customer_items"))
    .where("customer_items.type", customerItemType)
    .whereIn("customer_items.handout_branch_id", branchIDs)
    .where("customer_items.deadline", deadline);
}

async function aggregateCustomersToRemind(filter: ReminderFilter): Promise<ReminderCustomer[]> {
  const rows: {
    customerId: string;
    name: string;
    phone: string | null;
    email: string;
    guardianPhone: string | null;
    guardianEmail: string | null;
    title: string;
    blid: string | null;
    deadline: string;
  }[] = await booksToRemind(filter)
    .join("users", "users.id", "customer_items.customer_id")
    .join("items", "items.id", "customer_items.item_id")
    .orderBy("customer_items.customer_id")
    .orderBy("customer_items.deadline")
    .select(
      "customer_items.customer_id as customerId",
      "users.name",
      "users.phone",
      "users.email",
      "users.guardian_phone as guardianPhone",
      "users.guardian_email as guardianEmail",
      "items.title",
      "customer_items.blid",
      "customer_items.deadline",
    );
  const byCustomer = new Map<string, ReminderCustomer>();
  for (const row of rows) {
    let customer = byCustomer.get(row.customerId);
    if (customer === undefined) {
      customer = {
        customerId: row.customerId,
        name: row.name,
        phone: row.phone,
        email: row.email,
        guardian: { phone: row.guardianPhone, email: row.guardianEmail },
        customerItems: [],
      };
      byCustomer.set(row.customerId, customer);
    }
    customer.customerItems.push({
      title: row.title,
      blid: row.blid ?? "",
      deadline: row.deadline,
    });
  }
  return [...byCustomer.values()];
}

/** The deadline (`YYYY-MM-DD`) as it should read in an email. */
function formatDeadline(deadline: string) {
  return DateTime.fromISO(deadline).toFormat("dd/MM/yyyy");
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
      customerId: customer.customerId,
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
    const filter = await ctx.request.validateUsing(reminderValidator);
    const [row] = await booksToRemind(filter).countDistinct("customer_items.customer_id as count");
    return { recipientCount: Number(row?.count ?? 0) };
  }

  async send(ctx: HttpContext) {
    const { id: userId } = ctx.auth.getUserOrFail();

    const { deadline, customerItemType, branchIDs, emailTemplateId, smsText } =
      await ctx.request.validateUsing(reminderValidator);

    const customers = await aggregateCustomersToRemind({
      customerItemType,
      branchIDs,
      deadline,
    });

    const sendout = await MessageLogService.createSendout({
      kind: "reminder",
      name: `Påminnelse ${customerItemType === "rent" ? "lån" : "avbetaling"}, frist ${formatDeadline(deadline)}`,
      initiatedById: userId,
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
          customer.phone === null ? [] : [{ to: customer.phone, customerId: customer.customerId }],
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
              customerId: customer.customerId,
            })),
          smsText,
          context,
        );
      }
    }

    return { success: true };
  }
}
