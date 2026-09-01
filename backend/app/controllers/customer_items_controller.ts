import type { HttpContext } from "@adonisjs/core/http";
import { DateTime } from "luxon";
import { ObjectId } from "mongodb";

import { BlSchemaName } from "#models/mongoose/storage/bl-schema-names";
import { DateService } from "#services/legacy/date.service";
import { SEDbQuery } from "#services/legacy/query/se.db-query";
import { PermissionService } from "#services/permission_service";
import { StorageService } from "#services/storage_service";
import type { Branch } from "#shared/branch";
import type { ActiveCustomerItem } from "#shared/customer-item/active-customer-item";
import type { CustomerItemStatus } from "#shared/customer-item/actionable_customer_item";
import type { CustomerItem } from "#shared/customer-item/customer-item";

function isHandedOutWithinTheLastTwoWeeks(customerItem: CustomerItem) {
  const handedOutAt = customerItem.creationTime
    ? DateTime.fromJSDate(customerItem.creationTime)
    : DateTime.now();
  return DateTime.now() <= handedOutAt.plus({ weeks: 2 });
}

function isDeadlineWithGracePeriodExpired(customerItem: CustomerItem) {
  const now = DateTime.now().setZone("Europe/Oslo");

  // December grace period: allow buyout/extension through the holidays until Jan 1 next year.
  const graceDeadline =
    now.month === 12
      ? DateTime.fromObject(
          { year: now.year + 1, month: 1, day: 1 },
          { zone: "Europe/Oslo" },
        ).startOf("day")
      : DateTime.fromJSDate(customerItem.deadline).setZone("Europe/Oslo").endOf("day");

  return now > graceDeadline;
}

function branchHasExtensionsInTheFuture(originalDeadline: Date, branch: Branch): boolean {
  return (
    branch.paymentInfo?.extendPeriods.some(
      (extendPeriod) => originalDeadline.getTime() < extendPeriod.date.getTime(),
    ) ?? false
  );
}

function hasBeenExtendedBefore(customerItem: CustomerItem) {
  return (customerItem.periodExtends ?? []).length > 0;
}

function calculateExtensionStatus(customerItem: CustomerItem, branch: Branch | null) {
  if (!branch) {
    return {
      canExtend: false,
      feedback: "Fant ikke filialen som denne boka er utdelt på. Vennligst ta kontakt for hjelp",
    } as const;
  }

  if (isDeadlineWithGracePeriodExpired(customerItem)) {
    return {
      canExtend: false,
      feedback: "Fristen for å forlenge har utløpt",
    } as const;
  }

  if (!branchHasExtensionsInTheFuture(customerItem.deadline, branch)) {
    return {
      canExtend: false,
      feedback: "Denne filialen tilbyr for øyeblikket ikke forlenging",
    } as const;
  }

  if (hasBeenExtendedBefore(customerItem)) {
    return {
      canExtend: false,
      feedback: "Denne bøken har allerede blitt forlenget",
    } as const;
  }

  return {
    canExtend: true,
    feedback: "",
    options: branch.paymentInfo?.extendPeriods.map((extendPeriod) => ({
      date: extendPeriod.date,
      price: extendPeriod.price,
    })),
  } as const;
}

async function calculateBuyoutStatus(customerItem: CustomerItem, branch: Branch | null) {
  if (isDeadlineWithGracePeriodExpired(customerItem)) {
    return {
      canBuyout: false,
      feedback: "Fristen for å kjøpe ut har utløpt",
    } as const;
  }

  if (isHandedOutWithinTheLastTwoWeeks(customerItem)) {
    return {
      canBuyout: false,
      feedback: "Du må ha ha boken i minst 2 uker før du kan kjøpe den ut",
    } as const;
  }

  const item = await StorageService.Items.getOrNull(customerItem.item);
  const order = await StorageService.Orders.getOrNull(customerItem.orders.at(-1));
  const orderItem = order?.orderItems.find((oi) => oi.customerItem === customerItem.id);
  const buyoutPercentage =
    branch?.paymentInfo?.partlyPaymentPeriods?.find(
      (period) => period.type === orderItem?.info?.periodType,
    )?.percentageBuyout ?? branch?.paymentInfo?.buyout?.percentage;

  if (!item || !buyoutPercentage) {
    return {
      canBuyout: false,
      feedback: "Klarte ikke beregne utkjøpspris. Vennligst ta kontakt hvis du vil kjøpe ut boka.",
    } as const;
  }

  return {
    canBuyout: true,
    feedback: "",
    // oxlint-disable-next-line typescript/prefer-nullish-coalescing -- amountLeftToPay can be 0, which deliberately falls through to the computed buyout price
    price: customerItem.amountLeftToPay || Math.floor((item.price * buyoutPercentage) / 10) * 10,
  } as const;
}

function calculateStatus(customerItem: CustomerItem): CustomerItemStatus {
  if (customerItem.buyout) {
    return { type: "buyout", text: "Kjøpt ut" };
  }
  if (customerItem.returned) {
    return { type: "returned", text: "Returnert" };
  }

  if (customerItem.deadline.getTime() < Date.now()) {
    return { type: "overdue", text: "Fristen har utløpt" };
  }

  return { type: "active", text: "Aktiv" };
}

export default class CustomerItemsController {
  async getCustomerItems(ctx: HttpContext) {
    const { detailsId } = PermissionService.authenticate(ctx);
    const databaseQuery = new SEDbQuery();
    databaseQuery.stringFilters = [{ fieldName: "customer", value: detailsId }];
    databaseQuery.sortFilters = [{ fieldName: "lastUpdated", direction: -1 }];
    const customerItems = await StorageService.CustomerItems.getByQueryOrNull(databaseQuery);
    if (!customerItems) {
      return [];
    }

    return Promise.all(
      customerItems.map(async (customerItem) => {
        const item = await StorageService.Items.get(customerItem.item);
        const branch = await StorageService.Branches.get(customerItem.handoutInfo?.handoutById);
        const extensionStatus = calculateExtensionStatus(customerItem, branch);
        const buyoutStatus = await calculateBuyoutStatus(customerItem, branch);
        return {
          id: customerItem.id,
          item: {
            id: item.id,
            title: item.title,
            isbn: item.info.isbn.toString(),
          },
          blid: customerItem.blid,
          deadline: customerItem.deadline,
          handoutAt: customerItem.handoutInfo?.time,
          branch: {
            id: branch.id,
            name: branch.name,
          },
          status: calculateStatus(customerItem),
          actions: [
            ...(extensionStatus.options?.map(
              (extension) =>
                ({
                  type: "extend",
                  price: extension.price,
                  to: extension.date,
                  available: true,
                  tooltip: "",
                  label: `Forleng til ${DateService.format(
                    extension.date,
                    "Europe/Oslo",
                    "DD/MM/YYYY",
                  )}`,
                }) as const,
            ) ?? [
              {
                type: "extend",
                available: false,
                price: 0,
                tooltip: extensionStatus.feedback,
                label: "Forleng",
              } as const,
            ]),
            {
              type: "buyout",
              price: buyoutStatus.price ?? 0,
              available: buyoutStatus.canBuyout,
              tooltip: buyoutStatus.feedback,
              label: "Kjøp ut",
            },
          ],
        } as const;
      }),
    );
  }

  /**
   * The books a given customer is currently holding, for employees working the stand.
   * Separate from getCustomerItems because that one is scoped to the caller's own token and
   * leaves out the rental type.
   */
  async getActiveCustomerItemsForCustomer(ctx: HttpContext) {
    PermissionService.employeeOrFail(ctx);
    const detailsId = String(ctx.request.param("detailsId"));
    if (!ObjectId.isValid(detailsId)) {
      return [];
    }

    return StorageService.CustomerItems.aggregate<ActiveCustomerItem>([
      {
        $match: {
          returned: { $ne: true },
          buyout: { $ne: true },
          cancel: { $ne: true },
          buyback: { $ne: true },
          handout: true,
          customer: new ObjectId(detailsId),
        },
      },
      // The $lookup below overwrites "item" with the joined document, so the id is kept aside
      { $addFields: { itemId: "$item" } },
      {
        $lookup: {
          from: BlSchemaName.Items,
          localField: "item",
          foreignField: "_id",
          as: "item",
        },
      },
      { $unwind: { path: "$item", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          id: { $toString: "$_id" },
          item: { $toString: "$itemId" },
          title: { $ifNull: ["$item.title", "Ukjent bok"] },
          blid: { $ifNull: ["$blid", null] },
          type: "$type",
          deadline: "$deadline",
        },
      },
      { $sort: { deadline: 1, title: 1 } },
    ]);
  }
}
