import { randomInt } from "node:crypto";

import app from "@adonisjs/core/services/app";
import type { Font } from "fontkit";
import { openSync as openFont } from "fontkit";
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

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** One sticker as plain geometry: filled rectangles for the codes, and where the caption goes. */
interface LabelLayout {
  rects: Rect[];
  caption: { text: string; left: number; top: number; width: number };
}

/**
 * Where everything on a sticker sits, independent of what draws it. This is the single source of
 * the layout: the PDF the printer gets and the on-screen preview are both painted from it.
 */
function layoutLabel(id: string): LabelLayout {
  const rects: Rect[] = [];

  const qr = QRCode.create(id, { errorCorrectionLevel: "H" });
  const modules = qr.modules.size;
  const qrSize = modules * QRCODE.moduleSize;
  for (let row = 0; row < modules; row++) {
    for (let column = 0; column < modules; column++) {
      if (qr.modules.get(row, column)) {
        rects.push({
          x: column * QRCODE.moduleSize,
          y: QRCODE.top + row * QRCODE.moduleSize,
          width: QRCODE.moduleSize,
          height: QRCODE.moduleSize,
        });
      }
    }
  }

  const bars = encodeBarcode(id);
  const barsLeft = qrSize + LABEL.spaceBetween + BARCODE.margin;
  for (let module = 0; module < bars.length; module++) {
    if (bars[module] === "1") {
      rects.push({
        x: barsLeft + module * BARCODE.moduleWidth,
        y: BARCODE.margin,
        width: BARCODE.moduleWidth,
        height: BARCODE.height,
      });
    }
  }

  return {
    rects,
    caption: {
      text: `BL-${id}`,
      left: barsLeft,
      top: BARCODE.margin + BARCODE.height + BARCODE.textMargin,
      width: bars.length * BARCODE.moduleWidth,
    },
  };
}

/** Paints one sticker as vector shapes on the current page: QR code left, barcode and caption right. */
function drawLabel(doc: PDFKit.PDFDocument, id: string) {
  const { rects, caption } = layoutLabel(id);
  doc.fillColor("black");
  for (const rect of rects) {
    doc.rect(rect.x, rect.y, rect.width, rect.height);
  }
  doc.fill();

  doc.font(CAPTION_FONT).fontSize(BARCODE.fontSize).text(caption.text, caption.left, caption.top, {
    width: caption.width,
    align: "center",
    lineBreak: false,
  });
}

let captionFont: Font | undefined;
function loadCaptionFont(): Font {
  if (captionFont === undefined) {
    const opened = openFont(CAPTION_FONT);
    if (!("layout" in opened)) {
      throw new Error("The caption font file is a collection, expected a single font");
    }
    captionFont = opened;
  }
  return captionFont;
}

/**
 * The same sticker as an SVG, for showing on a screen. The codes are the layout's rectangles; the
 * caption is the font's own glyph outlines placed the way pdfkit places text in a box: centred
 * horizontally on the string's advance width, baseline one ascender below the top of the box.
 * Outlines instead of <text> so the image needs no font and matches the PDF wherever it is shown.
 */
function labelSvg(id: string): string {
  const { rects, caption } = layoutLabel(id);
  const codes = rects.map(
    (rect) => `M${rect.x} ${rect.y}h${rect.width}v${rect.height}h${-rect.width}z`,
  );

  const font = loadCaptionFont();
  const run = font.layout(caption.text);
  const scale = BARCODE.fontSize / font.unitsPerEm;
  let x = caption.left + (caption.width - run.advanceWidth * scale) / 2;
  const baseline = caption.top + font.ascent * scale;
  const glyphs = run.glyphs.map((glyph, index) => {
    const position = run.positions[index];
    const originX = x + (position?.xOffset ?? 0) * scale;
    const originY = baseline - (position?.yOffset ?? 0) * scale;
    x += (position?.xAdvance ?? glyph.advanceWidth) * scale;
    // Glyph outlines are in font units with y pointing up; flip and scale them into the label.
    return `<path transform="translate(${originX} ${originY}) scale(${scale} ${-scale})" d="${glyph.path.toSVG()}"/>`;
  });

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${LABEL.width} ${LABEL.height}" width="${LABEL.width}" height="${LABEL.height}">`,
    `<rect width="${LABEL.width}" height="${LABEL.height}" fill="#fff"/>`,
    `<path fill="#000" d="${codes.join("")}"/>`,
    `<g fill="#000">${glyphs.join("")}</g>`,
    "</svg>",
  ].join("");
}

const UniqueIdGeneratorService = {
  generateUnusedUniqueIds,
  layoutLabel,
  labelSvg,

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
