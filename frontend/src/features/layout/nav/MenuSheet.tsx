import type { Icon } from "@tabler/icons-react";
import { DrawerBody, DrawerContent, DrawerOverlay, DrawerRoot } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import type { ReactNode } from "react";

import classes from "@/features/layout/nav/Nav.module.css";
import type { FileRouteTypes } from "@/routeTree.gen";
import TanStackAnchor from "@/shared/components/TanStackAnchor";

/**
 * The menu's frame: on phones a sheet that rises from the tab bar, on desktop a drawer from the
 * right, with whatever content the site puts in it.
 */
export default function MenuSheet({
  opened,
  onClose,
  children,
}: {
  opened: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  // The drawer only ever opens after hydration, so the first (phone) value never paints.
  const wide = useMediaQuery("(min-width: 48em)");

  return (
    <DrawerRoot
      opened={opened}
      onClose={onClose}
      position={wide ? "right" : "bottom"}
      size={wide ? 380 : "auto"}
      scrollAreaComponent={wide ? undefined : NaturalHeight}
    >
      <DrawerOverlay backgroundOpacity={0.35} blur={2} />
      <DrawerContent
        classNames={{
          content: wide ? classes.sheetContent : `${classes.sheetContent} ${classes.bottom}`,
        }}
      >
        <DrawerBody className={classes.sheetBody}>{children}</DrawerBody>
      </DrawerContent>
    </DrawerRoot>
  );
}

/** Mantine wraps the drawer body in a full-viewport-height scroller; the sheet keeps its own height. */
function NaturalHeight({ children }: { children: ReactNode }) {
  return children;
}

/** One page in the menu: icon, name and, for a name that does not say what the page does, one line more. */
export function MenuRow({
  label,
  to,
  icon: RowIcon,
  description,
  active,
  tone,
  onNavigate,
}: {
  label: string;
  to: FileRouteTypes["to"];
  icon: Icon;
  description?: string;
  active: boolean;
  /** Red, for the one row that ends the session. */
  tone?: "danger";
  onNavigate: () => void;
}) {
  return (
    <TanStackAnchor
      to={to}
      className={classes.row}
      underline="never"
      data-active={active || undefined}
      data-tone={tone}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
    >
      <span className={classes.rowIcon}>
        <RowIcon size={22} stroke={1.7} aria-hidden />
      </span>
      <span className={classes.rowText}>
        <span className={classes.rowLabel}>{label}</span>
        {description && <span className={classes.rowDescription}>{description}</span>}
      </span>
    </TanStackAnchor>
  );
}
