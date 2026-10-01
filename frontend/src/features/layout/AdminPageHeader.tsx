import { Group } from "@mantine/core";

import Logo from "@/features/layout/Logo";

/** The teal bar over bl-admin: the wordmark, which leads to the dashboard. */
export default function AdminPageHeader() {
  return (
    <Group h="100%" align="center" px="md" wrap="nowrap">
      <Logo variant="white" admin />
    </Group>
  );
}
