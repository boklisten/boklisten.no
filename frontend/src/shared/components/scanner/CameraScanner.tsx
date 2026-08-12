import { type IDetectedBarcode, type IScannerError, Scanner } from "@yudiel/react-qr-scanner";
import { type ReactNode, useCallback, useRef } from "react";

import { determineScanCodeType, type ScanCodeType } from "@/shared/utils/scanCodes";

const DECODED_FORMATS = ["qr_code", "code_128", "ean_8", "ean_13"] as const;

function pickRelevantCode(
  detectedCodes: IDetectedBarcode[],
  accepts: ScanCodeType[] | undefined,
): string | undefined {
  const values = detectedCodes.map((code) => code.rawValue).filter((value) => value.length > 0);
  if (accepts === undefined) {
    return values[0];
  }
  return values.find((value) => accepts.includes(determineScanCodeType(value))) ?? values[0];
}

export default function CameraScanner({
  onCode,
  accepts,
  active = true,
  onCameraError,
  children,
}: {
  onCode: (code: string) => void | Promise<void>;
  accepts?: ScanCodeType[] | undefined;
  active?: boolean | undefined;
  onCameraError?: ((error: IScannerError) => void) | undefined;
  children?: ReactNode;
}) {
  // The handler closes over caller state that changes between steps of a multi-step scan flow, so
  // read it through a ref instead of whatever the scanner captured on an earlier render.
  const onCodeRef = useRef(onCode);
  onCodeRef.current = onCode;
  const acceptsRef = useRef(accepts);
  acceptsRef.current = accepts;
  const activeRef = useRef(active);
  activeRef.current = active;
  // Two detections can overlap, and handing out the same book twice is unrecoverable. Only ever
  // let one code be processed at a time.
  const busyRef = useRef(false);

  const handleDetection = useCallback(async (detectedCodes: IDetectedBarcode[]) => {
    if (!activeRef.current || busyRef.current) {
      return;
    }
    const code = pickRelevantCode(detectedCodes, acceptsRef.current);
    if (code === undefined) {
      return;
    }
    busyRef.current = true;
    try {
      await onCodeRef.current(code);
    } catch (error) {
      // onCode owns its own error reporting; this only stops an unhandled rejection.
      console.error("Failed to handle scanned code", error);
    } finally {
      busyRef.current = false;
    }
  }, []);

  return (
    <Scanner
      constraints={{ facingMode: "environment" }}
      formats={[...DECODED_FORMATS]}
      components={{ torch: true }}
      onScan={handleDetection}
      onError={onCameraError}
    >
      {children}
    </Scanner>
  );
}
