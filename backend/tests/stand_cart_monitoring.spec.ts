import { test } from "@japa/runner";

import { derivePlacementReports } from "#services/stand_cart/stand_cart_monitoring";
import type { PlacementReportInput } from "#services/stand_cart/stand_cart_monitoring";
import type { CustomerItem } from "#shared/customer-item/customer-item";
import type { Order } from "#shared/order/order";
import type { OrderItem } from "#shared/order/order-item/order-item";
import type { Payment } from "#shared/payment/payment";
import { mock } from "#tests/test-doubles";

const NOW = new Date("2026-09-07T10:00:00.000Z");
const SEMESTER_END = new Date("2026-12-20T00:00:00.000Z");
const PAST = new Date("2026-06-20T00:00:00.000Z");

function customerItemWith(overrides: Partial<CustomerItem> = {}): CustomerItem {
  return mock<CustomerItem>({
    id: "ci1",
    item: "item1",
    blid: "12345678",
    type: "rent",
    deadline: SEMESTER_END,
    handout: true,
    creationTime: new Date("2026-08-01T10:00:00.000Z"),
    handoutInfo: { handoutBy: "branch", handoutById: "branch1", time: NOW },
    periodExtends: [],
    ...overrides,
  });
}

function orderWith(orderItems: Partial<OrderItem>[]): Order {
  return mock<Order>({
    id: "new-order",
    customer: "customer1",
    branch: "branch1",
    orderItems: orderItems.map((orderItem) => ({
      type: "rent",
      item: "item1",
      title: "Sinus 1T",
      blid: "12345678",
      amount: 0,
      unitPrice: 0,
      handout: false,
      delivered: false,
      ...orderItem,
    })),
  });
}

function input(overrides: Partial<PlacementReportInput> & { order: Order }): PlacementReportInput {
  return {
    customerItemsBefore: new Map([["ci1", customerItemWith()]]),
    payments: [],
    signatureException: null,
    now: NOW,
    ...overrides,
  };
}

test.group("derivePlacementReports", () => {
  test("nothing to report for an ordinary handout on a branch period", ({ assert }) => {
    const reports = derivePlacementReports(
      input({
        order: orderWith([{ handout: true, info: { to: SEMESTER_END, periodType: "semester" } }]),
      }),
    );
    assert.deepEqual(reports, []);
  });

  test("every loan handed out without a valid signature is reported with the reason", ({
    assert,
  }) => {
    const reports = derivePlacementReports(
      input({
        order: orderWith([
          { handout: true, info: { to: SEMESTER_END, periodType: "semester" } },
          { type: "buy", handout: true, blid: "87654321" },
        ]),
        signatureException: "Aldri signert",
      }),
    );
    assert.deepEqual(reports, [
      {
        action: "handout-without-signature",
        details: [
          { label: "Bok", value: "«Sinus 1T»" },
          { label: "Unik ID", value: "12345678" },
          { label: "Grunn", value: "Aldri signert" },
        ],
      },
    ]);
  });

  test("a returned book past its deadline is reported with the deadline", ({ assert }) => {
    const reports = derivePlacementReports(
      input({
        order: orderWith([{ type: "return", customerItem: "ci1" }]),
        customerItemsBefore: new Map([["ci1", customerItemWith({ deadline: PAST })]]),
      }),
    );
    assert.deepEqual(reports, [
      {
        action: "overdue-book-collected",
        details: [
          { label: "Bok", value: "«Sinus 1T»" },
          { label: "Unik ID", value: "12345678" },
          { label: "Frist", value: "20.06.2026" },
        ],
      },
    ]);
  });

  test("a buyout inside the first two weeks and a late cancel are reported", ({ assert }) => {
    const reports = derivePlacementReports(
      input({
        order: orderWith([
          { type: "buyout", amount: 250, unitPrice: 250, customerItem: "ci1" },
          { type: "cancel", customerItem: "ci2", blid: "87654321" },
        ]),
        customerItemsBefore: new Map([
          ["ci1", customerItemWith({ creationTime: new Date("2026-09-05T10:00:00.000Z") })],
          [
            "ci2",
            customerItemWith({
              id: "ci2",
              blid: "87654321",
              creationTime: new Date("2026-08-01T10:00:00.000Z"),
            }),
          ],
        ]),
      }),
    );
    assert.deepEqual(
      reports.map((report) => [report.action, report.details.at(-1)?.value]),
      [
        [
          "active-item-action-outside-rules",
          "Kunden må ha hatt boka i minst to uker for at den skal kunne kjøpes ut",
        ],
        [
          "active-item-action-outside-rules",
          "Boka ble delt ut for mer enn to uker siden, og skal normalt ikke kanselleres",
        ],
      ],
    );
    assert.equal(reports[0]?.details[2]?.value, "Kjøpt ut");
    assert.equal(reports[1]?.details[2]?.value, "Kansellert");
  });

  test("cash taken at the stand is reported once for the order, with the amount and the books", ({
    assert,
  }) => {
    const reports = derivePlacementReports(
      input({
        order: orderWith([
          { type: "buy", handout: true, amount: 250, unitPrice: 250 },
          { type: "buy", handout: true, amount: 100, unitPrice: 100, title: "Kosmos SF" },
        ]),
        payments: [mock<Payment>({ method: "cash", amount: 350 })],
      }),
    );
    assert.deepEqual(reports, [
      {
        action: "cash-payment-received",
        details: [
          { label: "Beløp", value: "350 kr" },
          { label: "Bøker", value: "«Sinus 1T», «Kosmos SF»" },
        ],
      },
    ]);
  });

  test("card and Vipps payments are not reported", ({ assert }) => {
    const reports = derivePlacementReports(
      input({
        order: orderWith([{ type: "buy", handout: true, amount: 250, unitPrice: 250 }]),
        payments: [mock<Payment>({ method: "card", amount: 250 })],
      }),
    );
    assert.deepEqual(reports, []);
  });

  test("a refund sent back via Vipps is reported once for the order, with the amount and what was refunded", ({
    assert,
  }) => {
    const reports = derivePlacementReports(
      input({
        order: orderWith([
          { type: "cancel", amount: -250, unitPrice: -250 },
          { type: "buyback", amount: -100, unitPrice: -100, title: "Kosmos SF" },
        ]),
        payments: [
          mock<Payment>({ method: "vipps-epayment", amount: -250 }),
          mock<Payment>({ method: "vipps-checkout", amount: -100 }),
        ],
      }),
    );
    assert.deepEqual(reports, [
      {
        action: "vipps-refund-made",
        details: [
          { label: "Beløp", value: "350 kr" },
          { label: "Bøker", value: "«Sinus 1T»: kansellert, 250 kr; «Kosmos SF»: tilbakekjøp, 100 kr" },
        ],
      },
    ]);
  });

  test("a refund the administrator transfers by hand is not reported", ({ assert }) => {
    const reports = derivePlacementReports(
      input({
        order: orderWith([{ type: "cancel", amount: -250, unitPrice: -250 }]),
        payments: [mock<Payment>({ method: "bank-transfer", amount: -250 })],
      }),
    );
    assert.deepEqual(reports, []);
  });
});
