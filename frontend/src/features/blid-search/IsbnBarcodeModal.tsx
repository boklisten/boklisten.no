import { Modal } from "@mantine/core";
import JsBarcode from "jsbarcode";
import { useEffect, useRef, useState } from "react";

import WarningAlert from "@/shared/components/alerts/WarningAlert";

/** The ISBN as the EAN-13 barcode printed on a book's back cover, for scanning off the screen. */
export default function IsbnBarcodeModal({
  isbn,
  opened,
  onClose,
}: {
  isbn: string;
  opened: boolean;
  onClose: () => void;
}) {
  return (
    <Modal opened={opened} onClose={onClose} title="ISBN" size="md" centered>
      <EanBarcode value={isbn} />
    </Modal>
  );
}

/**
 * Standard EAN-13: the guard bars reach below the others, the first digit sits left of the
 * bars, and the remaining twelve are set in two groups of six beneath them.
 */
function EanBarcode({ value }: { value: string }) {
  const ref = useRef<SVGSVGElement>(null);
  const [valid, setValid] = useState(true);

  useEffect(() => {
    const svg = ref.current;
    if (!svg) {
      return;
    }
    JsBarcode(svg, value, {
      format: "EAN13",
      flat: false,
      width: 3,
      height: 150,
      fontSize: 36,
      textMargin: 4,
      margin: 20,
      background: "#fff",
      lineColor: "#000",
      valid: setValid,
    });
    // JsBarcode sizes the svg in pixels; let it scale with the modal instead.
    const width = svg.width.baseVal.value;
    const height = svg.height.baseVal.value;
    if (width > 0 && height > 0) {
      svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
      svg.removeAttribute("width");
      svg.removeAttribute("height");
    }
  }, [value]);

  if (!valid) {
    return (
      <WarningAlert>{value} er ikke et gyldig ISBN, så det finnes ingen strekkode.</WarningAlert>
    );
  }
  return (
    <svg
      ref={ref}
      role="img"
      aria-label={`Strekkode for ISBN ${value}`}
      style={{
        display: "block",
        width: "100%",
        height: "auto",
        borderRadius: "var(--mantine-radius-md)",
      }}
    />
  );
}
