import { Drawer } from "@base-ui/react/drawer";
import { DrawerBody, DrawerContent, DrawerOverlay, DrawerRoot } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { useRef } from "react";
import type { ReactNode } from "react";

import classes from "@/features/layout/nav/Nav.module.css";

/**
 * The menu's frame: on phones a sheet that rises from the tab bar and is swiped down to close (the
 * grabber on top says so), on desktop a drawer from the right, with whatever content the site puts
 * in it.
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

  if (!wide) {
    return (
      <PhoneSheet opened={opened} onClose={onClose} label="Meny">
        {children}
      </PhoneSheet>
    );
  }

  return (
    <DrawerRoot opened={opened} onClose={onClose} position="right" size={380}>
      <DrawerOverlay backgroundOpacity={0.35} blur={2} />
      <DrawerContent classNames={{ content: classes.sheetContent }}>
        <DrawerBody className={classes.sheetBody}>{children}</DrawerBody>
      </DrawerContent>
    </DrawerRoot>
  );
}

/**
 * Whether an Escape or a press came from a dialog opened on top of the sheet (a correction, a
 * confirmation). That one closes on its own; the sheet under it stays.
 */
function fromDialogOnTop(event: Event, popup: HTMLElement | null): boolean {
  const target = event.target;
  if (!(target instanceof Element) || popup === null) {
    return false;
  }
  const dialog = target.closest('[role="dialog"]');
  return dialog !== null && dialog !== popup && !popup.contains(dialog);
}

/**
 * The phone sheet, on Base UI's Drawer for its swipe to close: it follows the finger from anywhere
 * on the sheet while the list is scrolled to the top, and closes on a long drag or a flick. The
 * menu uses it, and so does any other phone panel that should feel the same (a book's details).
 *
 * TODO: back to Mantine's Drawer (and drop @base-ui/react) once Mantine ships swipe to close,
 * planned for Mantine 10.
 */
export function PhoneSheet({
  opened,
  onClose,
  label,
  belowModals = false,
  children,
}: {
  opened: boolean;
  onClose: () => void;
  /** The sheet's accessible name. */
  label: string;
  /**
   * One layer under Mantine's modals, for a sheet whose content opens dialogs of its own (a
   * correction, a confirmation), which must land on top of it.
   */
  belowModals?: boolean;
  children: ReactNode;
}) {
  const popupRef = useRef<HTMLDivElement>(null);
  const layer = belowModals ? { zIndex: "calc(var(--mantine-z-index-modal) - 1)" } : undefined;
  return (
    <Drawer.Root
      open={opened}
      onOpenChange={(open, details) => {
        if (!open && !fromDialogOnTop(details.event, popupRef.current)) {
          onClose();
        }
      }}
    >
      <Drawer.Portal>
        <Drawer.Backdrop className={classes.sheetBackdrop} style={layer} />
        <Drawer.Viewport className={classes.sheetViewport} style={layer}>
          <Drawer.Popup
            ref={popupRef}
            aria-label={label}
            className={`${classes.sheetContent} ${classes.bottom}`}
          >
            <div className={classes.grabber} aria-hidden />
            {/* A div, not Drawer.Content: that keeps text selectable by mouse, which here would
                stop a drag that starts on a row. */}
            <div className={classes.sheetBody}>{children}</div>
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
