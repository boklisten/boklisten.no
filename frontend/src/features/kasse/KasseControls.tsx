import { Button, Flex, Stack, Text, ThemeIcon } from "@mantine/core";
import { IconScan, IconSearch } from "@tabler/icons-react";
import { ViewTransition } from "react";
import type { ReactNode } from "react";

import bookCountLabel from "@/features/bulk-collection/bookCountLabel";
import { useCollectionState } from "@/features/bulk-collection/collectionStore";
import type { StoredCollection } from "@/features/bulk-collection/collectionStore";
import { InnsamlingIcon } from "@/features/bulk-collection/innsamlingIcon";
import { KASSE_HERO_TEXT, KASSE_VIEW_CONFIG } from "@/features/kasse/kasseViews";
import type { KasseView } from "@/features/kasse/kasseViews";
import classes from "@/features/kasse/KasseControls.module.css";
import { openSearch } from "@/features/search/openSearch";
import StickyToolbar from "@/shared/components/StickyToolbar";
import ScanCodeIcon from "@/shared/components/scanner/ScanCodeIcon";

// Unique IDs and phone numbers are digits, so the number pad is the right keyboard everywhere
const searchManually = () => openSearch({ keyboard: "numeric" });

/** The Innsamling entry; with a batch waiting it says so, and that pressing it picks it up. */
function innsamlingLabel({ scannedBooks }: StoredCollection): string {
  return scannedBooks.length > 0
    ? `Fortsett innsamling · ${bookCountLabel(scannedBooks.length)}`
    : "Innsamling";
}

/**
 * The ways into the Kasse: the camera (one button named after the view's usual scan; the camera
 * itself lets the other code be picked), the manual search, and the Innsamling. Renders as a
 * centered hero while there is nothing on the page yet, and as a sticky row once there is, so the
 * next scan is always one tap away. The same shape in every view keeps the page feeling like one
 * tool.
 */
export default function KasseControls({
  view,
  onScan,
  onOpenInnsamling,
  children,
}: {
  view: KasseView;
  onScan: () => void;
  /** The hero's Innsamling entry was pressed. */
  onOpenInnsamling: () => void;
  /** Rides along in the sticky row: the bar for a list that waits. */
  children?: ReactNode;
}) {
  const { scanLabel, defaultScanType } = KASSE_VIEW_CONFIG[view];
  const collection = useCollectionState();

  if (view !== "empty") {
    return (
      <StickyToolbar>
        <Stack gap="xs">
          <Flex gap="xs" wrap="wrap" justify={{ base: "center", sm: "flex-start" }}>
            {/* Named like the hero's buttons, so those glide into these; a new label is a cut */}
            <ViewTransition name="kasse-scan" update="none">
              <Button
                px="sm"
                className={classes.rowButton}
                leftSection={<ScanCodeIcon accepts={[defaultScanType]} size={18} />}
                onClick={onScan}
              >
                {scanLabel}
              </Button>
            </ViewTransition>
            <ViewTransition name="kasse-search" update="none">
              <Button
                px="sm"
                className={classes.rowButton}
                variant="default"
                leftSection={<IconSearch size={18} aria-hidden />}
                onClick={searchManually}
              >
                Søk manuelt
              </Button>
            </ViewTransition>
          </Flex>
          {children}
        </Stack>
      </StickyToolbar>
    );
  }

  return (
    <Stack align="center" gap="md" py="xl">
      <ThemeIcon variant="light" size="xl" radius="xl">
        <IconScan aria-hidden />
      </ThemeIcon>
      <Text c="dimmed" ta="center" maw={420}>
        {KASSE_HERO_TEXT}
      </Text>
      <ViewTransition name="kasse-scan" update="none">
        <Button
          size="lg"
          radius="md"
          leftSection={<ScanCodeIcon accepts={[defaultScanType]} size={24} />}
          onClick={onScan}
        >
          {scanLabel}
        </Button>
      </ViewTransition>
      <ViewTransition name="kasse-search" update="none">
        <Button
          variant="subtle"
          color="gray"
          leftSection={<IconSearch size={18} aria-hidden />}
          onClick={searchManually}
        >
          Søk manuelt
        </Button>
      </ViewTransition>
      {/* Paired with the Innsamling card; the share class lets the stylesheet hide the button while its box is card-sized */}
      <ViewTransition name="kasse-innsamling" share="kasse-innsamling-button">
        <Button
          mt="md"
          variant="default"
          leftSection={<InnsamlingIcon size={18} aria-hidden />}
          onClick={onOpenInnsamling}
        >
          {innsamlingLabel(collection)}
        </Button>
      </ViewTransition>
    </Stack>
  );
}
