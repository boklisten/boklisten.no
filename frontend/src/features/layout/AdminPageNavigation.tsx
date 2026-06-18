import { Divider, NavLink, ScrollArea, Stack } from "@mantine/core";
import {
  IconBarcode,
  IconBell,
  IconBooks,
  IconBuildings,
  IconBuildingStore,
  IconChartBar,
  IconChartHistogram,
  IconChecklist,
  IconDatabase,
  IconEdit,
  IconExternalLink,
  IconFileDollar,
  IconHourglassLow,
  IconLogout,
  IconMailFast,
  IconQrcode,
  IconReceipt,
  IconSearch,
  IconSend,
  IconShoppingCart,
  IconUserEdit,
  IconUserPlus,
} from "@tabler/icons-react";
import { useLocation } from "@tanstack/react-router";
import { Activity } from "react";

import useAuth from "@/shared/hooks/useAuth";
import TanStackAnchor from "@/shared/components/TanStackAnchor";

export default function AdminPageNavigation({
  onNavigate = () => {
    return;
  },
}: {
  onNavigate?: () => void;
}) {
  const pathname = useLocation({ select: (location) => location.pathname });
  const { isAdmin } = useAuth();
  return (
    <Stack justify={"space-between"} h={"100%"}>
      <ScrollArea>
        <Stack gap={5}>
          <NavLink
            label={"BL-ID-søk"}
            to={"/admin/blid"}
            active={pathname === "/admin/blid"}
            leftSection={<IconSearch />}
            underline={"never"}
            c={"black"}
            component={TanStackAnchor}
            onClick={onNavigate}
          />
          <NavLink
            label={"Handlekurv"}
            to={"/admin/handlekurv"}
            active={pathname === "/admin/handlekurv"}
            leftSection={<IconShoppingCart />}
            underline={"never"}
            c={"black"}
            component={TanStackAnchor}
            onClick={onNavigate}
          />
          <NavLink
            label={"Hurtiginnsamling"}
            to={"/admin/hurtiginnsamling"}
            active={pathname === "/admin/hurtiginnsamling"}
            leftSection={<IconQrcode />}
            underline={"never"}
            c={"black"}
            component={TanStackAnchor}
            onClick={onNavigate}
          />
          <NavLink
            label={"Hurtigutdeling"}
            to={"/admin/hurtigutdeling"}
            active={pathname === "/admin/hurtigutdeling"}
            leftSection={<IconChecklist />}
            underline={"never"}
            c={"black"}
            component={TanStackAnchor}
            onClick={onNavigate}
          />
          <NavLink
            label={"Ordreoversikt"}
            to={"/admin/ordreoversikt"}
            active={pathname === "/admin/ordreoversikt"}
            leftSection={<IconReceipt />}
            underline={"never"}
            c={"black"}
            component={TanStackAnchor}
            onClick={onNavigate}
          />
          <NavLink
            label={"Venteliste"}
            to={"/admin/venteliste"}
            active={pathname === "/admin/venteliste"}
            leftSection={<IconHourglassLow />}
            underline={"never"}
            c={"black"}
            component={TanStackAnchor}
            onClick={onNavigate}
          />
          <NavLink
            label={"Scanner"}
            to={"/admin/scanner"}
            active={pathname === "/admin/scanner"}
            leftSection={<IconBarcode />}
            underline={"never"}
            c={"black"}
            component={TanStackAnchor}
            onClick={onNavigate}
          />
          <NavLink
            label={"Innsikt"}
            to={"/admin/innsikt"}
            active={pathname === "/admin/innsikt"}
            leftSection={<IconChartHistogram />}
            underline={"never"}
            c={"black"}
            component={TanStackAnchor}
            onClick={onNavigate}
          />
          <Activity mode={isAdmin ? "visible" : "hidden"}>
            <Divider label={"Admin"} />
            <NavLink
              label={"Faktura"}
              to={"/admin/faktura"}
              active={pathname === "/admin/faktura"}
              leftSection={<IconFileDollar />}
              underline={"never"}
              c={"black"}
              component={TanStackAnchor}
              onClick={onNavigate}
            />
            <NavLink
              label={"Kommunikasjon"}
              leftSection={<IconMailFast />}
              active={pathname.includes("kommunikasjon")}
              c={"black"}
            >
              <NavLink
                label={"Påminnelser"}
                to={"/admin/kommunikasjon/paminnelser"}
                active={pathname === "/admin/kommunikasjon/paminnelser"}
                leftSection={<IconBell />}
                underline={"never"}
                c={"black"}
                component={TanStackAnchor}
                onClick={onNavigate}
              />
              <NavLink
                label={"Utsendelser"}
                to={"/admin/kommunikasjon/utsendelser"}
                active={pathname === "/admin/kommunikasjon/utsendelser"}
                leftSection={<IconSend />}
                underline={"never"}
                c={"black"}
                component={TanStackAnchor}
                onClick={onNavigate}
              />
            </NavLink>
            <NavLink
              label={"Databaseverktøy"}
              leftSection={<IconDatabase />}
              active={pathname.includes("database")}
            >
              <NavLink
                label={"Rapporter"}
                to={"/admin/database/rapporter"}
                active={pathname === "/admin/database/rapporter"}
                leftSection={<IconChartBar />}
                underline={"never"}
                c={"black"}
                component={TanStackAnchor}
                onClick={onNavigate}
              />
              <NavLink
                label={"Bøker"}
                to={"/admin/database/boker"}
                active={pathname === "/admin/database/boker"}
                leftSection={<IconBooks />}
                underline={"never"}
                c={"black"}
                component={TanStackAnchor}
                onClick={onNavigate}
              />
              <NavLink
                label={"Filialer"}
                to={"/admin/database/filialer"}
                active={pathname === "/admin/database/filialer"}
                leftSection={<IconBuildingStore />}
                underline={"never"}
                c={"black"}
                component={TanStackAnchor}
                onClick={onNavigate}
              />
              <NavLink
                label={"Selskap"}
                to={"/admin/database/selskap"}
                active={pathname === "/admin/database/selskap"}
                leftSection={<IconBuildings />}
                underline={"never"}
                c={"black"}
                component={TanStackAnchor}
                onClick={onNavigate}
              />
              <NavLink
                label={"Dynamisk innhold"}
                to={"/admin/database/dynamisk_innhold"}
                active={pathname === "/admin/database/dynamisk_innhold"}
                leftSection={<IconEdit />}
                underline={"never"}
                c={"black"}
                component={TanStackAnchor}
                onClick={onNavigate}
              />
              <NavLink
                label={"Unike IDer"}
                to={"/admin/database/unik_id"}
                active={pathname === "/admin/database/unik_id"}
                leftSection={<IconQrcode />}
                underline={"never"}
                c={"black"}
                component={TanStackAnchor}
                onClick={onNavigate}
              />
              <NavLink
                label={"Lag brukere"}
                to={"/admin/database/lag_brukere"}
                active={pathname === "/admin/database/lag_brukere"}
                leftSection={<IconUserPlus />}
                underline={"never"}
                c={"black"}
                component={TanStackAnchor}
                onClick={onNavigate}
              />
            </NavLink>
          </Activity>
        </Stack>
      </ScrollArea>

      <Stack gap={5} mb={"md"}>
        <Divider label={"Bruker"} />
        <NavLink
          label={"Brukerinnstillinger"}
          to={"/admin/user-settings"}
          active={pathname.includes("/user-settings")}
          leftSection={<IconUserEdit />}
          variant={"subtle"}
          underline={"never"}
          c={"black"}
          component={TanStackAnchor}
          onClick={onNavigate}
        />
        <NavLink
          label={"Gå til kundeside"}
          description={"Se offentlig informasjon og egne bøker"}
          to={"/"}
          leftSection={<IconExternalLink />}
          component={TanStackAnchor}
          active
          underline={"never"}
          onClick={onNavigate}
        />
        <NavLink
          label={"Logg ut"}
          to={"/auth/logout"}
          leftSection={<IconLogout />}
          variant={"subtle"}
          component={TanStackAnchor}
          active
          underline={"never"}
          color={"red"}
          onClick={onNavigate}
        />
      </Stack>
    </Stack>
  );
}
