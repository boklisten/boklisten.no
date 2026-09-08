import { Stack, Text } from "@mantine/core";
import type { StackProps } from "@mantine/core";

import ScanCodeIllustration from "@/shared/components/scanner/ScanCodeIllustration";
import { describeScanCodeLocation } from "@/shared/utils/scanCodes";
import type { ScanCodeType } from "@/shared/utils/scanCodes";

/**
 * An empty state that asks for a scan: the code to hunt for, drawn large, the ask under it, and
 * where on the book or phone the code sits. The same picture for a camera and a barcode reader.
 */
export default function ScanPrompt({
  type,
  children,
  ...stackProps
}: {
  type: ScanCodeType;
  /** The ask, as a headline without a period: "Skann bokas ISBN" */
  children: string;
} & Omit<StackProps, "children">) {
  const location = describeScanCodeLocation(type);
  return (
    <Stack align="center" gap="xs" py="md" {...stackProps}>
      <ScanCodeIllustration type={type} scale={2} />
      <Text ta="center" fw={500} mt="xs">
        {children}
      </Text>
      {location !== null && (
        <Text ta="center" size="sm" c="dimmed" maw={280}>
          {location}.
        </Text>
      )}
    </Stack>
  );
}
