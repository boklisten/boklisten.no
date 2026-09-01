import { Anchor, Center, Group, Stack, Text } from "@mantine/core";
import { IconLocation, IconMail, IconPhone } from "@tabler/icons-react";

import { CONTACT_INFO } from "@/shared/utils/constants";

const ContactInfo = () => (
  <Center>
    <Group gap="xl" justify="center">
      <Group>
        <IconPhone />
        <Stack gap={2}>
          <Text>Ring oss</Text>
          <Anchor href={`tel:${CONTACT_INFO.phone}`}>{CONTACT_INFO.phone}</Anchor>
        </Stack>
      </Group>

      <Group>
        <IconMail />
        <Stack gap={2}>
          <Text>Send oss en e-post</Text>
          <Anchor href={`mailto:${CONTACT_INFO.email}`}>{CONTACT_INFO.email}</Anchor>
        </Stack>
      </Group>

      <Group>
        <IconLocation />
        <Stack gap={2}>
          <Text>Vår adresse</Text>
          <Group>
            <Text fs="italic">{CONTACT_INFO.address}</Text>
          </Group>
        </Stack>
      </Group>
    </Group>
  </Center>
);

export default ContactInfo;
