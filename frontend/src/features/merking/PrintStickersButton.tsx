import { Button } from "@mantine/core";
import { modals } from "@mantine/modals";
import { IconPrinter } from "@tabler/icons-react";

import StickerGuide from "@/features/merking/StickerGuide";

/** Opens the guide, whose own button prints the sheet. */
export default function PrintStickersButton() {
  return (
    <Button
      variant="default"
      leftSection={<IconPrinter size={18} aria-hidden />}
      onClick={() =>
        modals.open({ title: "Nye unike IDer", size: "xl", children: <StickerGuide /> })
      }
    >
      Skriv ut nye unike IDer
    </Button>
  );
}
