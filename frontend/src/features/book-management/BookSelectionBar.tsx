import type { Item } from "@boklisten/backend/shared/item";
import { ActionBar, Button, Text } from "@mantine/core";
import { IconDownload } from "@tabler/icons-react";

import classes from "@/features/book-management/BookSelectionBar.module.css";
import { downloadBooksXlsx } from "@/features/book-management/bookSpreadsheet";

/**
 * Floats at the bottom while books are ticked: how many, and the way to get them as Excel.
 * Ticking exists only to download, so a download also clears the selection.
 */
export default function BookSelectionBar({
  selected,
  onClear,
}: {
  selected: Item[];
  onClear: () => void;
}) {
  return (
    <ActionBar
      opened={selected.length > 0}
      onClose={onClear}
      closeOnEscape
      shadow="lg"
      radius="lg"
      aria-label="Valgte bøker"
      className={classes.bar}
    >
      <Text fw={600} size="sm" style={{ whiteSpace: "nowrap" }}>
        {`${selected.length} valgt`}
      </Text>
      <ActionBar.Divider />
      <Button
        size="compact-md"
        variant="light"
        leftSection={<IconDownload size={16} />}
        onClick={() => {
          downloadBooksXlsx(selected);
          onClear();
        }}
      >
        Last ned
      </Button>
      <ActionBar.CloseButton aria-label="Fjern valg" />
    </ActionBar>
  );
}
