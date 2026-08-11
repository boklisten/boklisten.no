import {
  Container,
  Divider,
  Group,
  NavLink,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from "@mantine/core";
import { useFocusWithin, useHover, useMergedRef, useReducedMotion } from "@mantine/hooks";
import { IconArrowRight } from "@tabler/icons-react";
import { Image } from "@unpic/react";

import { type AdminNavLink, visibleAdminNavSections } from "@/features/layout/adminNavigation";
import useAuth from "@/shared/hooks/useAuth";
import TanStackAnchor from "@/shared/components/TanStackAnchor";

function AdminNavCard({ link }: { link: AdminNavLink }) {
  const LinkIcon = link.icon;
  const { hovered, ref: hoverRef } = useHover<HTMLAnchorElement>();
  const { focused, ref: focusRef } = useFocusWithin<HTMLAnchorElement>();
  const still = useReducedMotion();
  const ease = still ? undefined : "200ms ease";
  const active = hovered || focused;
  const ref = useMergedRef(hoverRef, focusRef);

  return (
    <NavLink
      ref={ref}
      to={link.to}
      label={link.label}
      description={link.description}
      leftSection={
        <ThemeIcon variant={"light"} size={38} radius={"md"}>
          <LinkIcon size={20} aria-hidden />
        </ThemeIcon>
      }
      rightSection={
        <IconArrowRight
          size={16}
          aria-hidden
          style={{
            opacity: active ? 1 : 0,
            transition: ease && `opacity ${ease}`,
          }}
        />
      }
      component={TanStackAnchor}
      underline={"never"}
      c={"black"}
      styles={{
        root: {
          border: `1px solid var(--mantine-color-${active ? "brand-9" : "gray-3"})`,
          borderRadius: "var(--mantine-radius-md)",
          backgroundColor: "var(--mantine-color-body)",
          boxShadow: active ? "var(--mantine-shadow-xs)" : "none",
          transition: ease && `box-shadow ${ease}, border-color ${ease}`,
        },
        label: { fontWeight: 600, color: active ? "var(--mantine-color-brand-9)" : undefined },
        description: { color: "var(--mantine-color-gray-7)" },
      }}
    />
  );
}

function AdminNavGrid({ links }: { links: AdminNavLink[] }) {
  return (
    <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing={"md"}>
      {links.map((link) => (
        <AdminNavCard key={link.label} link={link} />
      ))}
    </SimpleGrid>
  );
}

export default function AdminDashboard() {
  const { isAdmin } = useAuth();
  return (
    <Container size={"lg"} py={"xl"}>
      <Stack gap={50}>
        <Stack align={"center"} gap={"xs"}>
          <Image src={"/boklisten_logo_blue.png"} width={64} height={64} alt={"Boklisten.no"} />
          <Title order={1} ta={"center"} style={{ fontFamily: "serif" }} c={"brand.9"}>
            Velkommen til <span style={{ whiteSpace: "nowrap" }}>bl-admin</span>
          </Title>
          <Text c={"gray.7"} ta={"center"} maw={"46ch"}>
            Her er verktøyene du trenger for å dele ut, samle inn og holde orden på bøkene.
          </Text>
        </Stack>

        {visibleAdminNavSections(isAdmin).map((section) => (
          <Stack key={section.label} gap={"lg"}>
            <Divider
              label={
                <Title order={2} size={"xs"} tt={"uppercase"} lts={"0.08em"} c={"gray.7"}>
                  {section.label}
                </Title>
              }
              labelPosition={"left"}
            />
            <AdminNavGrid links={section.links} />
            {section.groups?.map((group) => {
              const GroupIcon = group.icon;
              return (
                <Stack key={group.label} gap={"sm"}>
                  <Group gap={6} c={"brand.9"}>
                    <GroupIcon size={18} aria-hidden />
                    <Title order={3} size={"sm"}>
                      {group.label}
                    </Title>
                  </Group>
                  <AdminNavGrid links={group.links} />
                </Stack>
              );
            })}
          </Stack>
        ))}
      </Stack>
    </Container>
  );
}
