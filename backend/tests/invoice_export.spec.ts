import { test } from "@japa/runner";
import { DateTime } from "luxon";

import { toSemicolonCsv } from "#services/invoices/csv";
import { objectIdCounter, tripletexRows, vismaRows } from "#services/invoices/invoice_export_rows";
import { pupilCustomerNumber } from "#services/invoices/invoice_generator_service";
import type { Branch } from "#shared/branch";
import type { CustomerItem } from "#shared/customer-item/customer-item";
import { invoiceStatus, invoiceStatusFlags } from "#shared/invoice";
import type { Invoice } from "#shared/invoice";
import type { Item } from "#shared/item";
import { customerItemDto } from "#tests/customer_item_fixtures";
import { invoiceDto, invoiceLineDto } from "#tests/invoice_fixtures";
import { mock } from "#tests/test-doubles";

const USER_DETAIL_ID = "65041cc7afe72e00496e2640";
const ITEM_ID = "6294d66878497a0046f9b3e6";
const CUSTOMER_ITEM_ID = "68a725b6dae0db228265cfd2";
const BRANCH_ID = "5b6442ecd2e733002fae8a44";

/** A rent invoice as legacy bl-admin generated it in July 2026 (staging data, anonymised). */
function rentInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return invoiceDto({
    id: "6a68aa7decdfd227ebc8f6dd",
    invoiceNumber: "20263071",
    type: "rent",
    branchId: BRANCH_ID,
    branchName: "Ullern VG3 ST",
    createdAt: new Date("2026-07-28T13:11:25.417Z"),
    dueDate: new Date("2026-08-11T13:11:05.460Z"),
    reference: "Manglende levering av skolebøker",
    lines: [
      invoiceLineDto({
        customerItemId: CUSTOMER_ITEM_ID,
        title: "Psykologi 2 2022",
        itemId: ITEM_ID,
        numberOfItems: 1,
        customerItemType: "rent",
        unit: 1049,
        gross: 1154,
        net: 1154,
        vat: 0,
        discount: 0,
      }),
    ],
    customerId: USER_DETAIL_ID,
    customerNumber: "93996",
    customerName: "Elise Nordmann",
    customerEmail: "elise@example.com",
    customerPhone: "48190306",
    customerDob: "2007-06-07",
    customerAddress: "Agmund Bolts Vei 11",
    customerPostCity: "Oslo",
    customerPostCode: "0664",
    totalGross: 1274,
    totalNet: 1250,
    totalVat: 24,
    totalDiscount: 0,
    feeUnit: 96,
    feeGross: 120,
    feeNet: 96,
    feeVat: 24,
    feeDiscount: 0,
    totalIncludingFee: 1274,
    ...overrides,
  });
}

/** A company invoice written by hand, with a comment. */
function companyInvoice(): Invoice {
  return invoiceDto({
    id: "6a98230a50a5b79c10143698",
    invoiceNumber: "20268005",
    type: null,
    createdAt: new Date("2026-09-02T13:22:18.705Z"),
    dueDate: new Date("2026-09-16T13:22:17.867Z"),
    ourReference: "Jørgen Rosenlund",
    reference: "Tove Fj. Johansen",
    lines: [
      invoiceLineDto({
        customerItemType: null,
        title: "Bios 1 2021",
        numberOfItems: 17,
        productNumber: 1,
        unit: 1249,
        gross: 8493.2,
        net: 8493.2,
        vat: 0,
        discount: 60,
      }),
    ],
    customerNumber: "988982857",
    customerName: "Kvitsund Gymnas",
    customerEmail: "bibliotek@kvitsund.vgs.no",
    customerOrganizationNumber: "988982857",
    customerPhone: "99240588",
    customerDob: null,
    customerAddress: "Jacob Naadlands veg 2",
    customerPostCity: "Kviteseid",
    customerPostCode: "3850",
    customerCountry: "norway",
    totalGross: 17_365.7,
    totalNet: 17_365.7,
    totalVat: 0,
    totalDiscount: 220,
    feeUnit: null,
    feeGross: null,
    feeNet: null,
    feeVat: null,
    feeDiscount: null,
    totalIncludingFee: 17_365.7,
    comment: "Bestillinger av 23.06.26 og 24.06.2026",
  });
}

test.group("invoice export: Visma", () => {
  test("a rent invoice becomes a header, a book line, a fee line and four text lines", ({
    assert,
  }) => {
    const rows = vismaRows([rentInvoice()], { ehf: false, creditOfInvoice: false });

    assert.deepEqual(
      rows.map((row) => [row[0], row[1], row[3], row[6]]),
      [
        ["H1", 0, "Elise Nordmann", "0664"],
        ["L1", 1, "V", "Psykologi 2 2022"],
        ["L1", 2, "V", "Administrasjonsgebyr"],
        [
          "L1",
          3,
          "K",
          "Fakturaen gjelder manglende/for sent leverte bøker fra forrige semester hos: Ullern VG3 ST",
        ],
        ["L1", 4, "K", "Kundens fødselsdato: 07.06.2007"],
        ["L1", 5, "K", "Kundens telefonnummer: 48190306"],
        ["L1", 6, "K", "Alle fakturahenvendelser sendes til info@boklisten.no"],
      ],
    );
  });

  test("the header carries dates in Oslo time, amounts in øre and the branch as our reference", ({
    assert,
  }) => {
    const [header] = vismaRows([rentInvoice()], { ehf: false, creditOfInvoice: false });

    assert.equal(header?.length, 71);
    assert.equal(header?.[2], "93996");
    assert.equal(header?.[12], "28072026");
    assert.equal(header?.[18], "11082026");
    assert.equal(header?.[19], "07062007");
    assert.deepEqual(header?.slice(20, 24), [127_400, 125_000, 2400, "IN"]);
    assert.equal(header?.[27], "Ullern VG3 ST");
    assert.equal(header?.[34], "P");
    assert.equal(header?.[61], "");
  });

  test("a book line uses the item's ObjectId counter as article number and FRI as VAT type", ({
    assert,
  }) => {
    const [, line] = vismaRows([rentInvoice()], { ehf: false, creditOfInvoice: false });

    assert.equal(line?.length, 39);
    assert.deepEqual(line?.slice(0, 14), [
      "L1",
      1,
      "20263071",
      "V",
      "FRI",
      String(objectIdCounter(ITEM_ID)),
      "Psykologi 2 2022",
      1,
      0,
      "",
      115_400,
      104_900,
      115_400,
      0,
    ]);
  });

  test("the fee line is article 1000 with PLH VAT, one unit per book", ({ assert }) => {
    const fee = vismaRows([rentInvoice()], { ehf: false, creditOfInvoice: false })[2];

    assert.deepEqual(fee?.slice(3, 14), [
      "V",
      "PLH",
      "1000",
      "Administrasjonsgebyr",
      1,
      0,
      "",
      12_000,
      9600,
      9600,
      2400,
    ]);
  });

  test("a company invoice has no fee, uses its comment as a text line and the org number in the header", ({
    assert,
  }) => {
    const rows = vismaRows([companyInvoice()], { ehf: false, creditOfInvoice: false });

    assert.equal(rows.length, 3);
    assert.equal(rows[0]?.[2], "988982857");
    assert.equal(rows[0]?.[19], "988982857");
    assert.equal(rows[0]?.[27], "Jørgen Rosenlund");
    assert.deepEqual(rows[1]?.slice(4, 9), ["FRI", 1, "Bios 1 2021", 17, 60]);
    assert.equal(rows[1]?.[10], 849_320.0000000001);
    assert.deepEqual(rows[2]?.slice(3, 7), [
      "K",
      "txt",
      "",
      "Bestillinger av 23.06.26 og 24.06.2026",
    ]);
  });

  test("EHF exports distribute by H and carry the org number as eInvoice reference", ({
    assert,
  }) => {
    const [header] = vismaRows([companyInvoice()], { ehf: true, creditOfInvoice: false });

    assert.equal(header?.[34], "H");
    assert.equal(header?.[61], "EHF");
    assert.equal(header?.[62], "988982857");
  });

  test("a credit note export replaces the header with a four-field H3 record", ({ assert }) => {
    const [header, line] = vismaRows([rentInvoice()], { ehf: false, creditOfInvoice: true });

    assert.deepEqual(header, ["H3", 0, "93996", "20263071"]);
    assert.equal(line?.[0], "L1");
  });
});

test.group("invoice export: customer numbers", () => {
  test("a pupil's number pairs the epoch and the counter of their user id", ({ assert }) => {
    // Computed by legacy bl-admin's InvoiceVismaService for the same id.
    assert.equal(pupilCustomerNumber(USER_DETAIL_ID), "93996");
  });

  test("the stored number is exported, also once the customer is deleted", ({ assert }) => {
    const [header] = vismaRows([rentInvoice({ customerId: null })], {
      ehf: false,
      creditOfInvoice: false,
    });
    assert.equal(header?.[2], "93996");
  });

  test("a missing date of birth prints as today's date, as legacy bl-admin did", ({ assert }) => {
    const rows = vismaRows([rentInvoice({ customerDob: null })], {
      ehf: false,
      creditOfInvoice: false,
    });
    assert.equal(rows[4]?.[6], `Kundens fødselsdato: ${DateTime.now().toFormat("dd.MM.yyyy")}`);
  });

  test("the article number is the counter part of the item id", ({ assert }) => {
    assert.equal(objectIdCounter(ITEM_ID), 0xf9_b3_e6);
  });
});

test.group("invoice export: Tripletex", () => {
  const lookups = {
    customerItems: new Map<string, CustomerItem>([
      [
        CUSTOMER_ITEM_ID,
        customerItemDto({
          id: CUSTOMER_ITEM_ID,
          itemId: ITEM_ID,
          createdAt: new Date("2025-08-20T10:00:00.000Z"),
          amountLeftToPay: 310,
          handoutBranchId: BRANCH_ID,
        }),
      ],
    ]),
    lastOrderIds: new Map([[CUSTOMER_ITEM_ID, "order2"]]),
    items: new Map<string, Item>([
      [ITEM_ID, mock<Item>({ id: ITEM_ID, title: "Psykologi 2 2022", isbn: 9_788_203_402_296 })],
    ]),
    branches: new Map<string, Branch>([
      [
        BRANCH_ID,
        mock<Branch>({
          id: BRANCH_ID,
          name: "Ullern VG3 ST",
          region: "Oslo",
          address: "Ullernchausséen 60",
        }),
      ],
    ]),
  };

  test("each invoice gets one row per book plus a fee row, under the header row", ({ assert }) => {
    const rows = tripletexRows([rentInvoice()], lookups);

    assert.equal(rows.length, 3);
    assert.equal(rows[0]?.[0], "INVOICE NO");
    assert.isTrue(rows.every((row) => row.length === 56));
    assert.deepEqual(rows[1]?.slice(0, 9), [
      "20263071",
      "2026-07-28",
      "2026-08-11",
      "",
      "",
      "",
      "order2",
      "2025-08-20",
      "93996",
    ]);
    assert.deepEqual(rows[1]?.slice(41, 48), [
      "2025-08-20",
      "Ullern VG3 ST",
      "Ullernchausséen 60",
      "",
      "",
      "",
      "",
    ]);
    assert.deepEqual(rows[1]?.slice(49, 56), [
      "9788203402296",
      "Psykologi 2 2022",
      "",
      "310",
      "1",
      "0",
      "5",
    ]);
    assert.deepEqual(rows[2]?.slice(49, 56), [
      "1000",
      "Administrasjonsgebyr",
      "",
      "96",
      "1",
      "0",
      "3",
    ]);
  });

  test("only the first book row of an invoice carries the comment", ({ assert }) => {
    const invoice = rentInvoice();
    const rows = tripletexRows(
      [{ ...invoice, lines: [...invoice.lines, ...invoice.lines] }],
      lookups,
    );

    assert.match(
      String(rows[1]?.[39]),
      /^Faktura gjelder manglende betaling av andre avdrag ved Ullern VG3 ST/,
    );
    assert.equal(rows[2]?.[39], "");
  });

  test("a line without a customer item cannot be exported", ({ assert }) => {
    assert.throws(() => tripletexRows([companyInvoice()], lookups), /Kundeboka null finnes ikke/);
  });
});

test.group("invoice export: CSV", () => {
  test("fields are separated by semicolons, rows padded to the widest row and ended by newline", ({
    assert,
  }) => {
    assert.equal(
      toSemicolonCsv([
        ["H3", 0, "1", "2"],
        ["L1", 1],
      ]),
      "H3;0;1;2\nL1;1;;\n",
    );
  });

  test("a string is quoted only when it contains a semicolon, quote or line break", ({
    assert,
  }) => {
    assert.equal(
      toSemicolonCsv([["Vei 7b", "Oslo; Norge", 'Sa "hei"', "to\nlinjer"]]),
      'Vei 7b;"Oslo; Norge";"Sa ""hei""";"to\nlinjer"\n',
    );
  });

  test("numbers lose floating point noise and missing values are empty", ({ assert }) => {
    assert.equal(
      toSemicolonCsv([[849_320.0000000001, 1_736_569.9999999998, 12.5, 0, undefined, null]]),
      "849320;1736570;12.5;0;;\n",
    );
  });
});

test.group("invoice status", () => {
  test("the four flags map to one status and back", ({ assert }) => {
    for (const status of ["unpaid", "paid", "creditNote", "debtCollection", "lossNote"] as const) {
      assert.equal(invoiceStatus(invoiceStatusFlags(status)), status);
    }
  });

  test("debt collection wins when old data has several flags set", ({ assert }) => {
    assert.equal(
      invoiceStatus({
        customerHasPaid: true,
        toDebtCollection: true,
        toCreditNote: false,
        toLossNote: false,
      }),
      "debtCollection",
    );
  });
});
