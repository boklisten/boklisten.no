import { Button, Stack, Text } from "@mantine/core";
import type { ButtonProps } from "@mantine/core";
import { modals } from "@mantine/modals";
import { IconQrcode } from "@tabler/icons-react";
import { QRCodeSVG } from "qrcode.react";
import type { ReactNode } from "react";

/** The customer's ID as the QR code the stand scans; the one rendering of it, wherever it is shown. */
export function openCustomerIdModal(
  customerId: string,
  { description, extraContent }: { description?: string; extraContent?: ReactNode } = {},
) {
  modals.open({
    title: "Kunde-ID",
    children: (
      <Stack align="center" w="100%">
        <QRCodeSVG
          value={customerId}
          size={288}
          style={{ border: "10px solid white", width: "100%", height: "auto", maxWidth: 300 }}
        />
        {description && (
          <Text size="sm" ta="center">
            {description}
          </Text>
        )}
        {extraContent}
      </Stack>
    ),
  });
}

export default function ShowCustomerIdButton({
  customerId,
  extraContent,
  ...buttonProps
}: {
  customerId: string;
  extraContent?: ReactNode;
} & ButtonProps) {
  return (
    <Button
      leftSection={<IconQrcode />}
      onClick={() =>
        openCustomerIdModal(customerId, {
          description: "Vis denne på stand, slik at vi kan finne deg raskere.",
          extraContent,
        })
      }
      {...buttonProps}
    >
      Vis kunde-ID
    </Button>
  );
}
