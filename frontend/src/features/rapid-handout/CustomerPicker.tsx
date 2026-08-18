import type { UserDetail } from "@boklisten/backend/shared/user-detail";
import { Button, Group, Kbd, Stack, Text } from "@mantine/core";
import { useOs } from "@mantine/hooks";
import { IconObjectScan, IconSearch } from "@tabler/icons-react";

import { customerSearch } from "@/features/rapid-handout/CustomerSearchSpotlight";
import openScannerModal from "@/shared/components/scanner/openScannerModal";
import useApiClient from "@/shared/hooks/useApiClient";

export default function CustomerPicker({
  onSelect,
}: {
  onSelect: (userDetail: UserDetail) => void;
}) {
  const { client } = useApiClient();
  const os = useOs();
  const desktop = os === "macos" || os === "windows" || os === "linux";

  function openCustomerScanner() {
    openScannerModal({
      title: "Skann kundeID",
      onScan: async (scannedText) => {
        const userDetail = await client.api.userDetail.getById({
          params: { detailsId: scannedText },
        });
        if (!userDetail) {
          return { message: `Fant ingen kunde med kundeID ${scannedText}.` };
        }
        onSelect(userDetail);
        return undefined;
      },
    });
  }

  return (
    <Stack align={"center"} gap={"md"} py={"xl"}>
      <Text c={"dimmed"} ta={"center"}>
        Skann kundens ID for å starte utdeling
      </Text>
      <Button
        size={"lg"}
        radius={"md"}
        leftSection={<IconObjectScan size={24} aria-hidden />}
        onClick={openCustomerScanner}
      >
        Skann kundeID
      </Button>
      <Button
        variant={"subtle"}
        color={"gray"}
        leftSection={<IconSearch size={18} aria-hidden />}
        onClick={customerSearch.open}
      >
        Søk manuelt
      </Button>
      {desktop && (
        <Group gap={6} c={"dimmed"} fz={"xs"}>
          <Text size={"xs"}>Tips: trykk</Text>
          <Kbd size={"xs"}>{os === "macos" ? "⌘" : "Ctrl"}</Kbd>
          <Text size={"xs"}>+</Text>
          <Kbd size={"xs"}>K</Kbd>
          <Text size={"xs"}>for å søke etter kunde når som helst</Text>
        </Group>
      )}
    </Stack>
  );
}
