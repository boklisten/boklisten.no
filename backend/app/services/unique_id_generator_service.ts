import { randomInt } from "node:crypto";

import app from "@adonisjs/core/services/app";
import JsBarcode from "jsbarcode";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";

import { StorageService } from "#services/storage_service";

const UNIQUE_ID_LENGTH = 12;
const VALID_BL_ID_CHARACTERS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const IDS_PER_PDF = 400;
/** Each id gets two consecutive, identical pages. */
const COPIES_PER_ID = 2;
const MAX_COLLISION_ROUNDS = 10;

/**
 * All sizes are PDF points, one per printer dot: the page is the 696 x 271 dot printable area of
 * a Brother 29 x 62 mm label. Positions and sizes are exactly those of the raster labels this
 * replaced (QR flush left, bars 5 pt into the barcode area), so the codes print and scan as before.
 */
const LABEL = { width: 696, height: 271, spaceBetween: 20 };
const QRCODE = { moduleSize: 6, top: 40 };
const BARCODE = { moduleWidth: 3, height: 210, margin: 5, textMargin: 2, fontSize: 40 };
/**
 * The Braille Institute's accessibility face: every glyph is drawn to be told apart from its
 * look-alikes (reverse-slashed 0 vs O, serifed 1/l/I, 5/S, 8/B), so an id can be typed by hand
 * from the sticker when scanning fails. Embedded in the PDF; SIL Open Font License, see the .txt
 * next to it.
 */
const CAPTION_FONT = app.makePath("resources/fonts/AtkinsonHyperlegibleMono-Bold.ttf");

function randomUniqueId() {
  return Array.from(
    { length: UNIQUE_ID_LENGTH },
    () => VALID_BL_ID_CHARACTERS[randomInt(VALID_BL_ID_CHARACTERS.length)],
  ).join("");
}

async function findTakenBlids(candidates: string[]): Promise<Set<string>> {
  const rows = await StorageService.UniqueItems.aggregate<{ blid: string }>([
    { $match: { blid: { $in: candidates } } },
    { $project: { _id: 0, blid: 1 } },
  ]);
  return new Set(rows.map((row) => row.blid));
}

/**
 * Fresh ids that are distinct from each other and from every blid already registered on a unique
 * item. The id space (62^12) makes a clash astronomically unlikely, but a sticker that collides
 * with a book already in circulation would be a nightmare to untangle, so we check anyway.
 */
async function generateUnusedUniqueIds(count: number): Promise<string[]> {
  const ids = new Set<string>();
  for (let round = 0; round < MAX_COLLISION_ROUNDS && ids.size < count; round++) {
    const candidates = new Set<string>();
    while (candidates.size < count - ids.size) {
      const candidate = randomUniqueId();
      if (!ids.has(candidate)) {
        candidates.add(candidate);
      }
    }
    const taken = await findTakenBlids([...candidates]);
    for (const candidate of candidates) {
      if (!taken.has(candidate)) {
        ids.add(candidate);
      }
    }
  }
  if (ids.size < count) {
    throw new Error("Could not generate enough unused unique ids");
  }
  return [...ids];
}

/** Code 128 bars for the id as a string of "1" (bar) and "0" (space), one char per module. */
function encodeBarcode(id: string): string {
  // JsBarcode's object renderer only encodes and writes the result onto the target.
  const target: { encodings?: { data: string }[] } = {};
  JsBarcode(target, id, { format: "CODE128" });
  const encoding = target.encodings?.[0];
  if (encoding === undefined) {
    throw new Error(`Could not encode barcode for ${id}`);
  }
  return encoding.data;
}

/** Draws one sticker as vector shapes on the current page: QR code left, barcode and caption right. */
function drawLabel(doc: PDFKit.PDFDocument, id: string) {
  const qr = QRCode.create(id, { errorCorrectionLevel: "H" });
  const modules = qr.modules.size;
  const qrSize = modules * QRCODE.moduleSize;
  doc.fillColor("black");
  for (let row = 0; row < modules; row++) {
    for (let column = 0; column < modules; column++) {
      if (qr.modules.get(row, column)) {
        doc.rect(
          column * QRCODE.moduleSize,
          QRCODE.top + row * QRCODE.moduleSize,
          QRCODE.moduleSize,
          QRCODE.moduleSize,
        );
      }
    }
  }
  doc.fill();

  const bars = encodeBarcode(id);
  const barsLeft = qrSize + LABEL.spaceBetween + BARCODE.margin;
  for (let module = 0; module < bars.length; module++) {
    if (bars[module] === "1") {
      doc.rect(
        barsLeft + module * BARCODE.moduleWidth,
        BARCODE.margin,
        BARCODE.moduleWidth,
        BARCODE.height,
      );
    }
  }
  doc.fill();

  doc
    .font(CAPTION_FONT)
    .fontSize(BARCODE.fontSize)
    .text(`BL-${id}`, barsLeft, BARCODE.margin + BARCODE.height + BARCODE.textMargin, {
      width: bars.length * BARCODE.moduleWidth,
      align: "center",
      lineBreak: false,
    });
}

const UniqueIdGeneratorService = {
  generateUnusedUniqueIds,

  async generateUniqueIdPdf(): Promise<Buffer> {
    const ids = await generateUnusedUniqueIds(IDS_PER_PDF);
    const doc = new PDFDocument({ autoFirstPage: false });

    for (const id of ids) {
      for (let copy = 0; copy < COPIES_PER_ID; copy++) {
        doc.addPage({ size: [LABEL.width, LABEL.height], margin: 0 });
        drawLabel(doc, id);
      }
    }

    doc.end();

    const buffers: Buffer[] = [];
    for await (const chunk of doc) {
      buffers.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(buffers);
  },
};

export default UniqueIdGeneratorService;
