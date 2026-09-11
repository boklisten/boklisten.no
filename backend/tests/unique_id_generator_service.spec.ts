import { inflateSync } from "node:zlib";

import { test } from "@japa/runner";
import type { PipelineStage } from "mongoose";
import type sinon from "sinon";
import { createSandbox } from "sinon";

import { StorageService } from "#services/storage_service";
import UniqueIdGeneratorService from "#services/unique_id_generator_service";
import { asStub } from "#tests/test-doubles";

const BLID_PATTERN = /^[a-zA-Z0-9]{12}$/;

/** The blids the service asked the database about in one round. */
function candidatesOf(pipeline: PipelineStage[]): string[] {
  const [stage] = pipeline;
  if (stage === undefined || !("$match" in stage)) {
    throw new Error("expected the lookup to start with a $match stage");
  }
  const blids: unknown = stage.$match["blid"]?.["$in"];
  return Array.isArray(blids) ? blids.filter((blid) => typeof blid === "string") : [];
}

/** Horizontal extent of every filled rectangle (QR modules and bars) across all pages. */
function rectangleExtent(pdf: Buffer): { left: number; right: number } {
  let left = Number.POSITIVE_INFINITY;
  let right = Number.NEGATIVE_INFINITY;
  let offset = 0;
  while (true) {
    const start = pdf.indexOf("stream\n", offset, "latin1");
    if (start === -1) {
      break;
    }
    const end = pdf.indexOf("endstream", start, "latin1");
    let content: string;
    try {
      content = inflateSync(pdf.subarray(start + 7, end)).toString("latin1");
    } catch {
      offset = end;
      continue; // not a Flate stream (e.g. the font program)
    }
    const rectangles = content.matchAll(/(?<x>-?[\d.]+) -?[\d.]+ (?<width>-?[\d.]+) -?[\d.]+ re/g);
    for (const { groups } of rectangles) {
      const x = Number(groups?.["x"]);
      left = Math.min(left, x);
      right = Math.max(right, x + Number(groups?.["width"]));
    }
    offset = end;
  }
  return { left, right };
}

test.group("UniqueIdGeneratorService", (group) => {
  let sandbox: sinon.SinonSandbox;

  group.each.setup(() => {
    sandbox = createSandbox();
    return () => sandbox.restore();
  });

  test("generates distinct, well-formed ids", async ({ assert }) => {
    sandbox.stub(StorageService.UniqueItems, "aggregate").resolves([]);

    const ids = await UniqueIdGeneratorService.generateUnusedUniqueIds(400);

    assert.lengthOf(ids, 400);
    assert.equal(new Set(ids).size, 400);
    for (const id of ids) {
      assert.match(id, BLID_PATTERN);
    }
  });

  test("replaces ids that already belong to a unique item", async ({ assert }) => {
    let taken = "";
    const aggregate = sandbox.stub(StorageService.UniqueItems, "aggregate");
    aggregate.callsFake((pipeline) => {
      if (taken === "") {
        taken = candidatesOf(pipeline)[0] ?? "";
        return Promise.resolve([{ blid: taken }]);
      }
      return Promise.resolve([]);
    });

    const ids = await UniqueIdGeneratorService.generateUnusedUniqueIds(400);

    assert.lengthOf(ids, 400);
    assert.match(taken, BLID_PATTERN);
    assert.notInclude(ids, taken);
    assert.equal(aggregate.callCount, 2);
    assert.lengthOf(candidatesOf(aggregate.getCall(0).args[0]), 400);
    assert.lengthOf(candidatesOf(aggregate.getCall(1).args[0]), 1);
  });

  test("gives up when every round collides", async ({ assert }) => {
    sandbox
      .stub(StorageService.UniqueItems, "aggregate")
      .callsFake((pipeline) => Promise.resolve(candidatesOf(pipeline).map((blid) => ({ blid }))));

    await assert.rejects(
      () => UniqueIdGeneratorService.generateUnusedUniqueIds(3),
      "Could not generate enough unused unique ids",
    );
  });

  test("renders two vector pages per id with the embedded caption font, fast", async ({
    assert,
  }) => {
    sandbox.stub(StorageService.UniqueItems, "aggregate").resolves([]);

    const started = performance.now();
    const pdf = await UniqueIdGeneratorService.generateUniqueIdPdf();
    const elapsed = performance.now() - started;

    const text = pdf.toString("latin1");
    assert.isTrue(text.startsWith("%PDF-"));
    assert.lengthOf(text.match(/\/Type \/Page(?!s)/g) ?? [], 800);
    assert.include(text, "AtkinsonHyperlegibleMono-Bold");
    // No raster images: the old PNG-per-label version embedded 800 of these.
    assert.notInclude(text, "/Subtype /Image");
    assert.isBelow(pdf.length, 3_000_000);
    // The raster version took ~10 s and ~900 MB; keep a wide margin for slow CI runners.
    assert.isBelow(elapsed, 5000);
    assert.equal(asStub(StorageService.UniqueItems.aggregate).callCount, 1);
  }).timeout(15_000);

  test("places the codes exactly where the raster labels had them", async ({ assert }) => {
    sandbox.stub(StorageService.UniqueItems, "aggregate").resolves([]);

    const pdf = await UniqueIdGeneratorService.generateUniqueIdPdf();
    const { left, right } = rectangleExtent(pdf);

    // QR flush left at 6 pt modules (25 x 6 = 150), 20 pt gap, 5 pt barcode margin, 167 bars x 3 pt.
    assert.equal(left, 0);
    assert.equal(right, 150 + 20 + 5 + 167 * 3);
  }).timeout(15_000);

  test("lays the screen label out exactly like the printed one", ({ assert }) => {
    const { rects, caption } = UniqueIdGeneratorService.layoutLabel("qx09og2bkfm1");

    // The 25 x 25 QR starts flush left, 40 pt down; the bars start 5 pt into the barcode area.
    const qrModules = rects.filter((rect) => rect.width === 6);
    const bars = rects.filter((rect) => rect.width === 3);
    assert.equal(Math.min(...qrModules.map((rect) => rect.x)), 0);
    assert.equal(Math.min(...qrModules.map((rect) => rect.y)), 40);
    assert.equal(Math.max(...qrModules.map((rect) => rect.y + rect.height)), 40 + 25 * 6);
    assert.equal(Math.min(...bars.map((rect) => rect.x)), 150 + 20 + 5);
    assert.isTrue(bars.every((rect) => rect.y === 5 && rect.height === 210));
    assert.deepEqual(caption, {
      text: "BL-qx09og2bkfm1",
      left: 175,
      top: 5 + 210 + 2,
      width: 167 * 3,
    });
  });

  test("renders the label as a self-contained svg with the caption as outlines", ({ assert }) => {
    const svg = UniqueIdGeneratorService.labelSvg("qx09og2bkfm1");

    assert.isTrue(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 696 271"'));
    assert.include(svg, "M0 40h6v6h-6z"); // the QR's top-left finder module
    assert.notInclude(svg, "<text"); // glyph outlines, so no font is needed to show it
    // "BL-" and the twelve id characters, each scaled from font units and flipped upright.
    assert.lengthOf(svg.match(/<path transform="translate\(/g) ?? [], 15);
    assert.include(svg, "scale(0.04 -0.04)");
    // pdfkit puts the baseline one ascender (984/1000 em) below the top of the caption box.
    assert.include(svg, `${217 + 0.984 * 40})`);
  });
});
