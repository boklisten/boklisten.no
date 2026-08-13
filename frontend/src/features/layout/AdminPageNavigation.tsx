import { Divider, NavLink, ScrollArea, Stack } from "@mantine/core";
import { IconExternalLink, IconLogout, IconUserEdit } from "@tabler/icons-react";
import { useLocation } from "@tanstack/react-router";
import { Fragment } from "react";

import {
  type AdminNavLink,
  isAdminNavLinkActive,
  visibleAdminNavSections,
} from "@/features/layout/adminNavigation";
import useAuth from "@/shared/hooks/useAuth";
import TanStackAnchor from "@/shared/components/TanStackAnchor";

function AdminNavItem({
  link,
  pathname,
  onNavigate,
}: {
  link: AdminNavLink;
  pathname: string;
  onNavigate: () => void;
}) {
  const LinkIcon = link.icon;
  return (
    <NavLink
      label={link.label}
      to={link.to}
      active={isAdminNavLinkActive(link, pathname)}
      leftSection={<LinkIcon />}
      underline={"never"}
      c={"var(--mantine-color-text)"}
      component={TanStackAnchor}
      onClick={onNavigate}
    />
  );
}

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
          {visibleAdminNavSections(isAdmin).map((section) => (
            <Fragment key={section.label}>
              <Divider label={section.label} />
              {section.links.map((link) => (
                <AdminNavItem
                  key={link.label}
                  link={link}
                  pathname={pathname}
                  onNavigate={onNavigate}
                />
              ))}
              {section.groups?.map((group) => {
                const GroupIcon = group.icon;
                return (
                  <NavLink
                    key={group.label}
                    label={group.label}
                    leftSection={<GroupIcon />}
                    active={group.links.some((link) => isAdminNavLinkActive(link, pathname))}
                    c={"var(--mantine-color-text)"}
                    component={"button"}
                  >
                    {group.links.map((link) => (
                      <AdminNavItem
                        key={link.label}
                        link={link}
                        pathname={pathname}
                        onNavigate={onNavigate}
                      />
                    ))}
                  </NavLink>
                );
              })}
            </Fragment>
          ))}
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
          c={"var(--mantine-color-text)"}
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
