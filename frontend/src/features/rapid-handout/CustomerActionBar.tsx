import type { UserDetail } from "@boklisten/backend/shared/user-detail";
import { Box, Button, Flex } from "@mantine/core";
import { IconObjectScan, IconSearch } from "@tabler/icons-react";

import { openCustomerSearch } from "@/features/rapid-handout/CustomerSearchSpotlight";
import useCustomerScanner from "@/features/rapid-handout/useCustomerScanner";

export default function CustomerActionBar({
  onSelect,
}: {
  onSelect: (userDetail: UserDetail) => void;
}) {
  const openCustomerScanner = useCustomerScanner(onSelect);

  return (
    <Box
      pos={"sticky"}
      py={"xs"}
      style={{
        top: "var(--app-shell-header-offset, 0px)",
        zIndex: 10,
        backgroundColor: "var(--mantine-color-body)",
      }}
    >
      <Flex gap={"xs"} wrap={"wrap"} justify={{ base: "center", sm: "flex-start" }}>
        <Button
          px={"sm"}
          leftSection={<IconObjectScan size={18} aria-hidden />}
          onClick={openCustomerScanner}
        >
          Skann kundeID
        </Button>
        <Button
          px={"sm"}
          variant={"default"}
          leftSection={<IconSearch size={18} aria-hidden />}
          onClick={openCustomerSearch}
        >
          Søk manuelt
        </Button>
      </Flex>
    </Box>
  );
}
