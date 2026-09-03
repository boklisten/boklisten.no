import { test } from "@japa/runner";

import {
  availableExtendPeriods,
  calculateExtensionStatus,
  resolveBuyoutPrice,
} from "#services/customer_item_actions_service";
import type { Branch } from "#shared/branch";
import type { CustomerItem } from "#shared/customer-item/customer-item";
import type { Item } from "#shared/item";
import { mock } from "#tests/test-doubles";

const DEADLINE = new Date("2027-01-15T00:00:00.000Z");
const LATER = new Date("2027-07-01T00:00:00.000Z");
const EARLIER = new Date("2026-12-20T00:00:00.000Z");

function customerItemWith(extensions: number): CustomerItem {
  return mock<CustomerItem>({
    id: "ci1",
    deadline: DEADLINE,
    periodExtends: Array.from({ length: extensions }, () => ({
      from: EARLIER,
      to: DEADLINE,
      periodType: "semester",
      time: EARLIER,
    })),
  });
}

function branchWith(
  extendPeriods: { date: Date; maxNumberOfPeriods: number; price?: number }[],
): Branch {
  return mock<Branch>({
    id: "branch1",
    paymentInfo: {
      responsible: false,
      rentPeriods: [],
      extendPeriods: extendPeriods.map((period) => ({
        type: "semester",
        date: period.date,
        maxNumberOfPeriods: period.maxNumberOfPeriods,
        price: period.price ?? 100,
      })),
    },
  });
}

test.group("availableExtendPeriods", () => {
  test("offers a period that ends after the deadline while the book is under its cap", ({
    assert,
  }) => {
    const periods = availableExtendPeriods(
      customerItemWith(0),
      branchWith([{ date: LATER, maxNumberOfPeriods: 1 }]),
    );
    assert.deepEqual(
      periods.map((period) => period.date),
      [LATER],
    );
  });

  test("leaves out periods that end before the current deadline", ({ assert }) => {
    const periods = availableExtendPeriods(
      customerItemWith(0),
      branchWith([{ date: EARLIER, maxNumberOfPeriods: 5 }]),
    );
    assert.deepEqual(periods, []);
  });

  test("counts every earlier extension against the cap, whatever period type it was", ({
    assert,
  }) => {
    const branch = branchWith([{ date: LATER, maxNumberOfPeriods: 2 }]);
    assert.lengthOf(availableExtendPeriods(customerItemWith(1), branch), 1);
    assert.lengthOf(availableExtendPeriods(customerItemWith(2), branch), 0);
  });

  test("keeps periods with room while dropping those already used up", ({ assert }) => {
    const once = new Date("2027-03-01T00:00:00.000Z");
    const periods = availableExtendPeriods(
      customerItemWith(1),
      branchWith([
        { date: once, maxNumberOfPeriods: 1 },
        { date: LATER, maxNumberOfPeriods: 3 },
      ]),
    );
    assert.deepEqual(
      periods.map((period) => period.date),
      [LATER],
    );
  });
});

test.group("calculateExtensionStatus", () => {
  test("explains when the book has hit the branch's extension cap", ({ assert }) => {
    const status = calculateExtensionStatus(
      customerItemWith(1),
      branchWith([{ date: LATER, maxNumberOfPeriods: 1 }]),
    );
    assert.isFalse(status.canExtend);
    assert.equal(
      status.feedback,
      "Denne boka er allerede forlenget så mange ganger som filialen tillater",
    );
  });

  test("tells the branch offers no extension when nothing ends after the deadline", ({
    assert,
  }) => {
    const status = calculateExtensionStatus(
      customerItemWith(0),
      branchWith([{ date: EARLIER, maxNumberOfPeriods: 9 }]),
    );
    assert.isFalse(status.canExtend);
    assert.equal(status.feedback, "Denne filialen tilbyr for øyeblikket ikke forlenging");
  });

  test("lists the dates and prices the book can still be extended to", ({ assert }) => {
    const status = calculateExtensionStatus(
      customerItemWith(0),
      branchWith([{ date: LATER, maxNumberOfPeriods: 1, price: 150 }]),
    );
    assert.isTrue(status.canExtend);
    assert.deepEqual(status.options, [{ date: LATER, price: 150 }]);
  });
});

test.group("resolveBuyoutPrice", () => {
  const item = mock<Item>({ id: "item1", price: 829 });

  test("uses the branch buyout share of the item price, rounded down to 10 kr", ({ assert }) => {
    const price = resolveBuyoutPrice({
      customerItem: mock<CustomerItem>({}),
      item,
      branch: mock<Branch>({
        paymentInfo: {
          responsible: false,
          rentPeriods: [],
          extendPeriods: [],
          buyout: { percentage: 0.5 },
        },
      }),
      periodType: "year",
    });
    assert.equal(price, 410);
  });

  test("prefers the partly-payment share for the period the book was handed out on", ({
    assert,
  }) => {
    const price = resolveBuyoutPrice({
      customerItem: mock<CustomerItem>({}),
      item,
      branch: mock<Branch>({
        paymentInfo: {
          responsible: false,
          rentPeriods: [],
          extendPeriods: [],
          buyout: { percentage: 0.5 },
          partlyPaymentPeriods: [
            {
              type: "year",
              date: LATER,
              percentageBuyout: 0.3,
              percentageBuyoutUsed: 0.3,
              percentageUpFront: 0.7,
              percentageUpFrontUsed: 0.7,
            },
          ],
        },
      }),
      periodType: "year",
    });
    assert.equal(price, 240);
  });

  test("charges what is left to pay on a partly-paid book, unless that is zero", ({ assert }) => {
    const branch = mock<Branch>({
      paymentInfo: {
        responsible: false,
        rentPeriods: [],
        extendPeriods: [],
        buyout: { percentage: 0.5 },
      },
    });
    assert.equal(
      resolveBuyoutPrice({
        customerItem: mock<CustomerItem>({ amountLeftToPay: 333 }),
        item,
        branch,
        periodType: undefined,
      }),
      333,
    );
    assert.equal(
      resolveBuyoutPrice({
        customerItem: mock<CustomerItem>({ amountLeftToPay: 0 }),
        item,
        branch,
        periodType: undefined,
      }),
      410,
    );
  });

  test("has no price when the branch never set a buyout share", ({ assert }) => {
    const price = resolveBuyoutPrice({
      customerItem: mock<CustomerItem>({}),
      item,
      branch: mock<Branch>({
        paymentInfo: { responsible: false, rentPeriods: [], extendPeriods: [] },
      }),
      periodType: undefined,
    });
    assert.isNull(price);
  });
});
