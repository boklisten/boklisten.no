import { DateTime } from "luxon";

import CustomerItem from "#models/customer_item";
import CustomerItemPeriodExtend from "#models/customer_item_period_extend";
import type { CustomerItem as CustomerItemDto } from "#shared/customer-item/customer-item";
import type { Period } from "#shared/period";
import { fixtureId } from "#tests/fixtures";

let sequence = 0;

type CustomerItemColumns = Pick<CustomerItem, (typeof CustomerItem.$columns)[number]>;

interface PeriodExtendFixture {
  periodFrom: DateTime;
  periodTo: DateTime;
  periodType?: Period;
  createdAt?: DateTime;
}

function extendColumns({ periodFrom, periodTo, periodType, createdAt }: PeriodExtendFixture) {
  return {
    periodFrom,
    periodTo,
    periodType: periodType ?? ("semester" as const),
    createdAt: createdAt ?? periodFrom,
  };
}

function withDefaults(
  overrides: Partial<CustomerItemColumns>,
  id: string,
): Partial<CustomerItemColumns> {
  return {
    id,
    type: "rent",
    blid: null,
    deadline: DateTime.fromISO("2027-07-01"),
    handoutEmployeeId: null,
    handedOutAt: DateTime.fromISO("2026-08-15T10:00:00"),
    returned: false,
    buyout: false,
    cancel: false,
    buyback: false,
    amountLeftToPay: null,
    ...overrides,
  };
}

/**
 * Inserts a customer item (and its extensions) into the test Postgres and reads it back. The item,
 * the handout branch and the customer (unless null) must exist already, since they are foreign
 * keys. Pass only what the test cares about.
 */
export async function createCustomerItem(
  overrides: Partial<CustomerItemColumns> &
    Pick<CustomerItemColumns, "itemId" | "customerId" | "handoutBranchId"> & {
      periodExtends?: PeriodExtendFixture[];
    },
): Promise<CustomerItem> {
  sequence++;
  const { periodExtends = [], ...columns } = overrides;
  const customerItem = await CustomerItem.create(
    withDefaults(columns, fixtureId(`e${sequence.toString(16)}`)),
  );
  await customerItem
    .related("periodExtends")
    .createMany(periodExtends.map((periodExtend) => extendColumns(periodExtend)));
  return CustomerItem.findOrFail(customerItem.id);
}

/**
 * A `CustomerItem` model instance that never touches the database, for pure functions (pricing,
 * rules, monitoring). Saving it would insert a row, so only hand it to code that reads.
 */
export function customerItemDouble(
  overrides: Partial<CustomerItemColumns> & { periodExtends?: PeriodExtendFixture[] } = {},
): CustomerItem {
  const { periodExtends = [], ...columns } = overrides;
  const customerItem = new CustomerItem();
  // oxlint-disable-next-line unicorn/no-array-fill-with-reference-type -- Lucid's fill, not Array#fill
  customerItem.fill({
    itemId: fixtureId("a1"),
    customerId: fixtureId("c0"),
    handoutBranchId: fixtureId("b1"),
    createdAt: DateTime.fromISO("2026-08-15T10:00:00"),
    updatedAt: DateTime.fromISO("2026-08-15T10:00:00"),
    ...withDefaults(columns, fixtureId("e0")),
  });
  customerItem.$setRelated(
    "periodExtends",
    periodExtends.map((periodExtend) => {
      const row = new CustomerItemPeriodExtend();
      // oxlint-disable-next-line unicorn/no-array-fill-with-reference-type -- Lucid's fill, not Array#fill
      row.fill(extendColumns(periodExtend));
      return row;
    }),
  );
  return customerItem;
}

/** A complete plain `CustomerItem` for pure functions that never touch the database. */
export function customerItemDto(overrides: Partial<CustomerItemDto> = {}): CustomerItemDto {
  return {
    id: fixtureId("e0"),
    itemId: fixtureId("a1"),
    blid: null,
    type: "rent",
    customerId: fixtureId("c0"),
    deadline: "2027-07-01",
    handoutBranchId: fixtureId("b1"),
    handoutEmployeeId: null,
    handedOutAt: new Date("2026-08-15T10:00:00Z"),
    returned: false,
    returnBranchId: null,
    returnEmployeeId: null,
    returnedAt: null,
    buyout: false,
    buyoutOrderId: null,
    boughtOutAt: null,
    cancel: false,
    cancelOrderId: null,
    cancelledAt: null,
    buyback: false,
    buybackOrderId: null,
    boughtBackAt: null,
    amountLeftToPay: null,
    periodExtends: [],
    createdAt: new Date("2026-08-15T10:00:00Z"),
    updatedAt: new Date("2026-08-15T10:00:00Z"),
    ...overrides,
  };
}
