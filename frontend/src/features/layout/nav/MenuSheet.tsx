import { Drawer } from "@base-ui/react/drawer";
import { DrawerBody, DrawerContent, DrawerOverlay, DrawerRoot } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
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
      <PhoneSheet opened={opened} onClose={onClose}>
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
 * The phone sheet, on Base UI's Drawer for its swipe to close: it follows the finger from anywhere
 * on the sheet while the list is scrolled to the top, and closes on a long drag or a flick.
 *
 * TODO: back to Mantine's Drawer (and drop @base-ui/react) once Mantine ships swipe to close,
 * planned for Mantine 10.
 */
function PhoneSheet({
  opened,
  onClose,
  children,
}: {
  opened: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Drawer.Root
      open={opened}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <Drawer.Portal>
        <Drawer.Backdrop className={classes.sheetBackdrop} />
        <Drawer.Viewport className={classes.sheetViewport}>
          <Drawer.Popup aria-label="Meny" className={`${classes.sheetContent} ${classes.bottom}`}>
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
