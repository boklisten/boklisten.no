import type { Item } from "@boklisten/backend/shared/item";
import type { Column, ImportResult, Validator } from "@importcsv/react";
import dayjs from "dayjs";
import { utils, writeFile } from "xlsx";

import { cellToString } from "@/shared/utils/csvNormalizers";

/** One spreadsheet row, the same flat shape the bulk endpoint validates. */
export interface BookRow {
  id?: string;
  title: string;
  isbn: number;
  subject: string;
  year: number;
  price: number;
  /** Kilograms; null when unknown. */
  weight: number | null;
  distributor: string;
  discount: number;
  publisher: string;
  active: boolean;
  buyback: boolean;
}

/**
 * The spreadsheet format is the one legacy bl-admin used: the book flattened with dot-separated
 * paths as headers. The importer matches file headers to these labels, so every file downloaded
 * from legacy bl-admin over the years maps itself on upload.
 */
const FIELDS = {
  id: "id",
  title: "title",
  isbn: "info.isbn",
  price: "price",
  subject: "info.subject",
  year: "info.year",
  weight: "info.weight",
  distributor: "info.distributor",
  discount: "info.discount",
  publisher: "info.publisher",
  active: "active",
  buyback: "buyback",
} as const satisfies Record<keyof BookRow, string>;

/** Legacy bl-admin put these first and appended every other field of the book in document order. */
const LEADING_FIELDS = [
  FIELDS.id,
  FIELDS.title,
  FIELDS.isbn,
  FIELDS.price,
  FIELDS.subject,
  FIELDS.year,
];

const YES = "Ja";
const NO = "Nei";
const DECIMAL_PATTERN = String.raw`^\d+([.,]\d+)?$`;
const OPTIONAL_DECIMAL_PATTERN = String.raw`^(\d+([.,]\d+)?)?$`;

function normalizeDecimal(value: unknown): string {
  return cellToString(value).trim().replace(",", ".");
}

function normalizeIsbn(value: unknown): string {
  return cellToString(value).replaceAll(/[\s-]/g, "");
}

/** Excel writes booleans as TRUE/FALSE (SANN/USANN in Norwegian); people type Ja/Nei. */
function normalizeYesNo(value: unknown): string {
  const text = cellToString(value).trim().toLowerCase();
  if (["ja", "j", "true", "sann", "1", "x", "yes"].includes(text)) {
    return YES;
  }
  if (["nei", "n", "false", "usann", "0", "no"].includes(text)) {
    return NO;
  }
  return cellToString(value).trim();
}

function required(label: string): Validator[] {
  return [{ type: "required", message: `${label} er påkrevd` }];
}

export const BOOK_IMPORT_COLUMNS: Column[] = [
  {
    id: "id",
    label: FIELDS.id,
    description: "Fra en nedlastet fil. La stå tom for nye bøker",
    transformations: [{ type: "trim" }],
  },
  {
    id: "title",
    label: FIELDS.title,
    validators: required(FIELDS.title),
    transformations: [{ type: "trim" }],
  },
  {
    id: "isbn",
    label: FIELDS.isbn,
    description: "Bare siffer, f.eks. 9788202516260",
    validators: [
      ...required(FIELDS.isbn),
      { type: "regex", pattern: "^\\d+$", message: "Må være bare siffer" },
    ],
    transformations: [{ type: "custom", fn: normalizeIsbn, stage: "pre" }],
  },
  {
    id: "price",
    label: FIELDS.price,
    description: "Kroner, f.eks. 935",
    validators: [
      ...required(FIELDS.price),
      { type: "regex", pattern: DECIMAL_PATTERN, message: "Må være et tall" },
    ],
    transformations: [{ type: "custom", fn: normalizeDecimal, stage: "pre" }],
  },
  {
    id: "subject",
    label: FIELDS.subject,
    validators: required(FIELDS.subject),
    transformations: [{ type: "trim" }],
  },
  {
    id: "year",
    label: FIELDS.year,
    description: "Årstall, f.eks. 2020",
    validators: [
      ...required(FIELDS.year),
      { type: "regex", pattern: "^(19|20)\\d{2}$", message: "Må være et årstall" },
    ],
    transformations: [{ type: "trim" }],
  },
  {
    id: "weight",
    label: FIELDS.weight,
    description: "Kilo, f.eks. 0,862. Tom når vekten er ukjent",
    validators: [{ type: "regex", pattern: OPTIONAL_DECIMAL_PATTERN, message: "Må være et tall" }],
    transformations: [{ type: "custom", fn: normalizeDecimal, stage: "pre" }],
  },
  {
    id: "distributor",
    label: FIELDS.distributor,
    validators: required(FIELDS.distributor),
    transformations: [{ type: "trim" }],
  },
  {
    id: "discount",
    label: FIELDS.discount,
    description: "Andel mellom 0 og 1, f.eks. 0,15 for 15 %",
    validators: [
      ...required(FIELDS.discount),
      {
        type: "regex",
        pattern: String.raw`^(0([.,]\d+)?|1([.,]0+)?)$`,
        message: "Må være et tall mellom 0 og 1",
      },
    ],
    transformations: [{ type: "custom", fn: normalizeDecimal, stage: "pre" }],
  },
  {
    id: "publisher",
    label: FIELDS.publisher,
    validators: required(FIELDS.publisher),
    transformations: [{ type: "trim" }],
  },
  {
    id: "active",
    label: FIELDS.active,
    description: "SANN/USANN eller Ja/Nei",
    validators: [
      ...required(FIELDS.active),
      { type: "regex", pattern: `^(${YES}|${NO})$`, message: "Må være Ja eller Nei" },
    ],
    transformations: [{ type: "custom", fn: normalizeYesNo, stage: "pre" }],
  },
  {
    id: "buyback",
    label: FIELDS.buyback,
    description: "SANN/USANN eller Ja/Nei",
    validators: [
      ...required(FIELDS.buyback),
      { type: "regex", pattern: `^(${YES}|${NO})$`, message: "Må være Ja eller Nei" },
    ],
    transformations: [{ type: "custom", fn: normalizeYesNo, stage: "pre" }],
  },
];

function cellText(row: Record<string, unknown>, key: keyof BookRow): string {
  return cellToString(row[key]).trim();
}

/** The importer has already validated every cell, so the conversions here cannot fail. */
export function toBookRows(result: ImportResult): BookRow[] {
  return result.rows.map((row) => {
    const id = cellText(row, "id");
    return {
      ...(id.length > 0 && { id }),
      title: cellText(row, "title"),
      isbn: Number(normalizeIsbn(row["isbn"])),
      subject: cellText(row, "subject"),
      year: Number(cellText(row, "year")),
      price: Number(normalizeDecimal(row["price"])),
      weight:
        normalizeDecimal(row["weight"]) === "" ? null : Number(normalizeDecimal(row["weight"])),
      distributor: cellText(row, "distributor"),
      discount: Number(normalizeDecimal(row["discount"])),
      publisher: cellText(row, "publisher"),
      active: normalizeYesNo(row["active"]) === YES,
      buyback: normalizeYesNo(row["buyback"]) === YES,
    };
  });
}

/**
 * One book as legacy bl-admin wrote it: the dot-path headers above plus one `info.price.<year>`
 * column per year of price history. An unknown weight is left out, as legacy dropped nulls.
 */
function toSpreadsheetRow(item: Item): Record<string, unknown> {
  return {
    [FIELDS.id]: item.id,
    [FIELDS.title]: item.title,
    [FIELDS.isbn]: item.isbn,
    [FIELDS.price]: item.price,
    [FIELDS.subject]: item.subject,
    [FIELDS.year]: item.year,
    ...(item.weight === null ? {} : { [FIELDS.weight]: item.weight }),
    [FIELDS.distributor]: item.distributor,
    [FIELDS.discount]: item.discount,
    [FIELDS.publisher]: item.publisher,
    [FIELDS.active]: item.active,
    [FIELDS.buyback]: item.buyback,
    ...Object.fromEntries(
      Object.entries(item.priceHistory).map(([year, price]) => [`info.price.${year}`, price]),
    ),
  };
}

/** The same file legacy bl-admin produced: every field of the book, including each year's price. */
export function downloadBooksXlsx(items: Item[]) {
  const rows = items.map((item) => toSpreadsheetRow(item));
  const header = LEADING_FIELDS.filter((field) => rows.some((row) => field in row));
  const sheet = utils.json_to_sheet(rows, { header });
  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, sheet, "items");
  writeFile(workbook, `items_${dayjs().format("DD_MM_YY")}.xlsx`);
}
