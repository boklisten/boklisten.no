import JsBarcode from "jsbarcode";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useRef } from "react";

import classes from "@/features/bokflyt/bokflyt.module.css";

/**
 * The sticker the stand prints for a book, drawn the same way as the backend's unique-ID
 * generator: a QR code with the id, and a Code 128 barcode captioned "BL-<id>".
 */
export default function BlidLabel({ id }: { id: string }) {
  const barcodeRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = barcodeRef.current;
    if (!svg) {
      return undefined;
    }
    JsBarcode(svg, id, {
      format: "CODE128",
      text: `BL-${id}`,
      fontSize: 40,
      width: 3,
      height: 210,
      margin: 5,
      marginBottom: 15,
      font: "ui-monospace, Menlo, monospace",
    });
    // JsBarcode sizes the svg in pixels; let it scale with the label instead.
    const width = svg.width.baseVal.value;
    const height = svg.height.baseVal.value;
    if (width > 0 && height > 0) {
      svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
      svg.removeAttribute("width");
      svg.removeAttribute("height");
    }
    return undefined;
  }, [id]);

  return (
    <div className={classes.blidLabel} aria-hidden>
      <QRCodeSVG value={id} level="H" className={classes.blidQr} />
      <svg ref={barcodeRef} className={classes.blidBarcode} />
    </div>
  );
}
