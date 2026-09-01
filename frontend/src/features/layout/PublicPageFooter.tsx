import { Group, Stack, Text } from "@mantine/core";
import { IconCopyright } from "@tabler/icons-react";
import dayjs from "dayjs";

import ContactInfo from "@/shared/components/ContactInfo";
import { ORGANIZATION_NUMBER } from "@/shared/utils/constants";
import TanStackAnchor from "@/shared/components/TanStackAnchor";
import { Image } from "@unpic/react";

export default function PublicPageFooter() {
  return (
    <Stack bg="#1e2e2c" c="#fff" align="center" mt="xl" p="md" component="footer">
      <ContactInfo />
      <Group mt={50}>
        <TanStackAnchor to="/info/policies/conditions">Betingelser</TanStackAnchor>
        {" | "}
        <TanStackAnchor to="/info/policies/terms">Vilkår</TanStackAnchor>
        {" | "}
        <TanStackAnchor to="/info/policies/privacy">Personvernserklæring</TanStackAnchor>
      </Group>
      <Text>Organisasjonsnummer: {ORGANIZATION_NUMBER} MVA</Text>
      <Group gap="xs">
        <Text>Boklisten.no AS</Text>
        <IconCopyright />
        {dayjs().format("YYYY")}
      </Group>
      <Text fw="bold">Støttet av</Text>
      <Image src="/images/skattefunn.jpg" alt="SkatteFUNN" width={146} height={82} />
    </Stack>
  );
}
