import { Box, Container, NavLink, Stack, Text, Title } from "@mantine/core";
import { IconExternalLink } from "@tabler/icons-react";
import { Image } from "@unpic/react";

import SearchShortcutHint from "@/features/search/SearchShortcutHint";
import TanStackAnchor from "@/shared/components/TanStackAnchor";
import TanStackButton from "@/shared/components/TanStackButton";
import classes from "@/features/layout/AdminDashboard.module.css";
import { ADMIN_HOME, ADMIN_PRIMARY_LINKS } from "@/features/layout/admin-nav/adminNavigation";
import { firstName } from "@/features/user/firstName";
import useAuth from "@/shared/hooks/useAuth";

/** The everyday tools, the same ones and in the same order as the phone tab bar after Hjem. */
const PRIMARY_TOOLS = ADMIN_PRIMARY_LINKS.filter((link) => link !== ADMIN_HOME);

/**
 * The dashboard: one centred column with the welcome, the everyday tools as its buttons (as the
 * front page's hero carries the public tab bar's), the way back to the customer site and, on a
 * desktop keyboard, a line on the search shortcuts. Every other tool lives in the sidebar and the
 * menu; the theme sits at the foot of the menu.
 */
export default function AdminDashboard() {
  const { user } = useAuth();

  return (
    <Container px={0} size="lg" py="xl">
      <Stack align="center" gap={0}>
        <Image src="/images/boklisten_logo_blue.webp" width={64} height={64} alt="Boklisten.no" />
        <Title order={1} mt="xs" ta="center" className={classes.title}>
          Velkommen{user ? `, ${firstName(user)}` : ""}
        </Title>
        <Text mt="sm" c="dimmed" ta="center" maw="46ch" style={{ textWrap: "balance" }}>
          Her er verktøyene du trenger for å dele ut, samle inn og holde orden på bøkene.
        </Text>
        <div className={classes.actions}>
          {PRIMARY_TOOLS.map((tool, index) => (
            <TanStackButton
              key={tool.to}
              to={tool.to}
              size="lg"
              radius="xl"
              variant={index === 0 ? "filled" : "outline"}
              leftSection={<tool.icon />}
            >
              {tool.label}
            </TanStackButton>
          ))}
        </div>
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
