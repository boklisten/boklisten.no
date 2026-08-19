import { Box, Burger, Drawer } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";

import AdminPageNavigation from "@/features/layout/AdminPageNavigation";

export default function AdminPageNavigationDrawer() {
  const [opened, { toggle, close }] = useDisclosure();

  return (
    <Box hiddenFrom={"xs"}>
      <Burger
        color={"white"}
        opened={opened}
        onClick={toggle}
        aria-label={opened ? "Lukk meny" : "Åpne meny"}
      />

      <Drawer opened={opened} onClose={close} position={"right"} title={"Velg side"}>
        <AdminPageNavigation onNavigate={close} />
      </Drawer>
    </Box>
  );
}
