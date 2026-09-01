import { Button, Stack, Text } from "@mantine/core";
import type { ButtonProps } from "@mantine/core";
import { modals } from "@mantine/modals";
import { IconQrcode } from "@tabler/icons-react";
import { QRCodeSVG } from "qrcode.react";
import type { ReactNode } from "react";

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
        modals.open({
          title: "Kunde-ID",
          children: (
            <Stack align="center" w="100%">
              <QRCodeSVG
                value={customerId}
                size={288}
                style={{ width: "100%", height: "auto", maxWidth: 300 }}
              />
              <Text size="sm" ta="center">
                Vis denne på stand, slik at vi kan finne deg raskere.
              </Text>
              {extraContent}
            </Stack>
          ),
        })
      }
      {...buttonProps}
    >
      Vis kunde-ID
    </Button>
  );
}
