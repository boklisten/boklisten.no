import { Burger, Divider, Drawer, NavLink, Stack } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  IconBook,
  IconClock,
  IconExternalLink,
  IconHeartHandshake,
  IconInfoCircle,
  IconLogin,
  IconLogout,
  IconMail,
  IconReceipt,
  IconSearch,
  IconShoppingCart,
  IconUserEdit,
  IconUserPlus,
} from "@tabler/icons-react";
import { Activity } from "react";

import TasksIndicator from "@/features/layout/TasksIndicator";
import TasksLink from "@/features/layout/TasksLink";
import useAuth from "@/shared/hooks/useAuth";
import { useLocation } from "@tanstack/react-router";
import TanStackAnchor from "@/shared/components/TanStackAnchor";

export default function PublicNavigationDrawer() {
  const pathname = useLocation({
    select: (location) => location.pathname,
  });
  const [opened, { toggle, close }] = useDisclosure();
  const { isLoggedIn, isEmployee } = useAuth();
  return (
    <>
      <Activity mode={isLoggedIn ? "visible" : "hidden"}>
        <TasksIndicator>
          <Burger
            color={"white"}
            opened={opened}
            onClick={toggle}
            aria-label={opened ? "Lukk meny" : "Åpne meny"}
          />
        </TasksIndicator>
      </Activity>
      <Activity mode={!isLoggedIn ? "visible" : "hidden"}>
        <Burger
          color={"white"}
          opened={opened}
          onClick={toggle}
          aria-label={opened ? "Lukk meny" : "Åpne meny"}
        />
      </Activity>

      <Drawer opened={opened} onClose={close} position={"right"} title={"Velg side"}>
        <Stack gap={5}>
          <Activity mode={isLoggedIn ? "visible" : "hidden"}>
            <TasksLink />
          </Activity>
          <NavLink
            label={"Bestill bøker"}
            to={"/bestilling"}
            active={pathname.includes("/bestilling")}
            underline={"never"}
            c={"var(--mantine-color-text)"}
            leftSection={<IconShoppingCart />}
            component={TanStackAnchor}
            onClick={close}
          />

          <Activity mode={isLoggedIn ? "visible" : "hidden"}>
            <NavLink
              label={"Dine bøker"}
              to={"/items"}
              active={pathname.includes("/items")}
              underline={"never"}
              c={"var(--mantine-color-text)"}
              leftSection={<IconBook />}
              component={TanStackAnchor}
              onClick={close}
            />
            <NavLink
              label={"Ordrehistorikk"}
              to={"/order-history"}
              active={pathname.includes("/order-history")}
              underline={"never"}
              c={"var(--mantine-color-text)"}
              leftSection={<IconReceipt />}
              component={TanStackAnchor}
              onClick={close}
            />
            <NavLink
              label={"Overleveringer"}
              to={"/overleveringer"}
              active={pathname.includes("/overleveringer")}
              underline={"never"}
              c={"var(--mantine-color-text)"}
              leftSection={<IconHeartHandshake />}
              component={TanStackAnchor}
              onClick={close}
            />
            <NavLink
              label={"Boksøk"}
              description={
                "Søk opp en bok sin unike ID for å finne ut hvem som er ansvarlig for den"
              }
              to={"/sjekk"}
              active={pathname.includes("/sjekk")}
              underline={"never"}
              c={"var(--mantine-color-text)"}
              leftSection={<IconSearch />}
              component={TanStackAnchor}
              onClick={close}
            />
          </Activity>
          <Divider label={"Informasjon"} />
          <NavLink
            label={"Generell informasjon"}
            to={"/info/general"}
            active={pathname.includes("/info/general")}
            variant={"subtle"}
            underline={"never"}
            c={"var(--mantine-color-text)"}
            leftSection={<IconInfoCircle />}
            component={TanStackAnchor}
            onClick={close}
          />
          <NavLink
            label={"Åpningstider"}
            to={"/info/branch"}
            active={pathname.includes("/info/branch")}
            variant={"subtle"}
            underline={"never"}
            c={"var(--mantine-color-text)"}
            leftSection={<IconClock />}
            component={TanStackAnchor}
            onClick={close}
          />
          <NavLink
            label={"Kontaktinformasjon"}
            to={"/info/contact"}
            active={pathname.includes("/info/contact")}
            variant={"subtle"}
            underline={"never"}
            c={"var(--mantine-color-text)"}
            leftSection={<IconMail />}
            component={TanStackAnchor}
            onClick={close}
          />

          <Divider label={"Bruker"} />

          <Activity mode={isLoggedIn ? "visible" : "hidden"}>
            <NavLink
              label={"Brukerinnstillinger"}
              to={"/user-settings"}
              active={pathname.includes("/user-settings")}
              underline={"never"}
              c={"var(--mantine-color-text)"}
              leftSection={<IconUserEdit />}
              component={TanStackAnchor}
              onClick={close}
            />
            <Activity mode={isEmployee ? "visible" : "hidden"}>
              <NavLink
                label={"Gå til bl-admin"}
                description={"Her kan du søke opp kunder, samle inn og dele ut bøker."}
                to={"/admin"}
                leftSection={<IconExternalLink />}
                component={TanStackAnchor}
                active
                color={"orange"}
                underline={"never"}
                onClick={close}
              />
            </Activity>
            <NavLink
              label={"Logg ut"}
              to={"/auth/logout"}
              leftSection={<IconLogout />}
              component={TanStackAnchor}
              active
              variant={"subtle"}
              underline={"never"}
              color={"red"}
              onClick={close}
            />
          </Activity>

          <Activity mode={!isLoggedIn ? "visible" : "hidden"}>
            <NavLink
              label={"Registrer"}
              component={TanStackAnchor}
              to={"/auth/register"}
              active={pathname.includes("/auth/register")}
              variant={"subtle"}
              underline={"never"}
              leftSection={<IconUserPlus />}
              onClick={close}
            />
            <NavLink
              label={"Logg inn"}
              component={TanStackAnchor}
              to={"/auth/login"}
              active={pathname.includes("/auth/login")}
              variant={"subtle"}
              underline={"never"}
              leftSection={<IconLogin />}
              onClick={close}
            />
          </Activity>
        </Stack>
      </Drawer>
    </>
  );
}
