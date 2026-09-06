import type { IconProps } from "@tabler/icons-react";
import { IconBarcode, IconObjectScan, IconUserScan } from "@tabler/icons-react";

import type { ScanCodeType } from "@/shared/utils/scanCodes";

function expectsOnly(accepts: ScanCodeType[], kinds: ScanCodeType[]): boolean {
  return accepts.length > 0 && accepts.every((type) => kinds.includes(type));
}

/**
 * The icon for a scan button: a person for a customer ID, bars for a book. Chosen from the same
 * `accepts` list the scanner is given, so the button never promises a code the scanner would reject.
 */
export default function ScanCodeIcon({
  accepts,
  ...iconProps
}: { accepts: ScanCodeType[] } & IconProps) {
  if (expectsOnly(accepts, ["customerId"])) {
    return <IconUserScan aria-hidden {...iconProps} />;
  }
  if (expectsOnly(accepts, ["blid", "isbn"])) {
    return <IconBarcode aria-hidden {...iconProps} />;
  }
  return <IconObjectScan aria-hidden {...iconProps} />;
}
