import { Box, Container, NavLink, Stack, Text, Title } from "@mantine/core";
import { IconExternalLink } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { Image } from "@unpic/react";

import SearchShortcutHint from "@/features/search/SearchShortcutHint";
import TanStackAnchor from "@/shared/components/TanStackAnchor";
import { authQueryOptions } from "@/features/auth/authQuery";

const BOOK_SERIF =
  '"Iowan Old Style", Palatino, "Palatino Linotype", "Book Antiqua", Georgia, serif';

/**
 * The dashboard: one centred column with the welcome, the way back to the customer site and, on a
 * desktop keyboard, a line on the search shortcuts. The tools live in the tab bar, the sidebar and
 * the menu, so the page lists none of them; the theme sits at the foot of the menu.
 */
export default function AdminDashboard() {
  const { data: user } = useQuery(authQueryOptions());
  const firstName = user?.name?.trim().split(" ")[0];

  return (
    <Container size="lg" py="xl">
      <Stack align="center" gap={0}>
        <Image src="/images/boklisten_logo_blue.webp" width={64} height={64} alt="Boklisten.no" />
        <Title
          order={1}
          mt="xs"
          ta="center"
          style={{ fontFamily: BOOK_SERIF }}
          c="var(--mantine-color-brand-text)"
        >
          Velkommen{firstName ? `, ${firstName}` : ""}
        </Title>
        <Text mt="sm" c="dimmed" ta="center" maw="46ch">
          Her er verktøyene du trenger for å dele ut, samle inn og holde orden på bøkene.
        </Text>
        {/* The way back to the customer site, as the front page points employees here: one
              pane in the calm brand tint, the mirror of the front page's orange one. */}
        <NavLink
          component={TanStackAnchor}
          to="/"
          label="Gå til kundeside"
          description="Se offentlig informasjon og egne bøker."
          leftSection={<IconExternalLink />}
          active
          underline="never"
          mt="xl"
          maw={420}
          styles={{
            root: { borderRadius: "var(--mantine-radius-md)" },
            label: { fontWeight: 600 },
          }}
        />
        <Box mt="xl">
          <SearchShortcutHint />
        </Box>
      </Stack>
    </Container>
  );
}
