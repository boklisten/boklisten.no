import { Button, Flex, Group, Stack, Text } from "@mantine/core";
import { IconPrinter } from "@tabler/icons-react";
import { useMutation } from "@tanstack/react-query";
import { useEffect } from "react";

import BookStickerAnimation from "@/features/merking/BookStickerAnimation";
import StepLabel from "@/features/merking/StepLabel";
import printStickerSheet, { prepareStickerSheet } from "@/features/merking/printStickerSheet";
import { showErrorNotification } from "@/shared/utils/notifications";

function GuideStep({ step, title, children }: { step: number; title: string; children: string }) {
  return (
    <Stack gap={6}>
      <StepLabel step={step}>{title}</StepLabel>
      <Text size="sm" c="dimmed">
        {children}
      </Text>
    </Stack>
  );
}

/**
 * The book with its two stickers on one side, the three steps that get them there on the other,
 * and the button that prints a sheet. Closing it lands on Merking, where the last step happens.
 */
export default function StickerGuide() {
  // Fetch a sheet while the guide is being read, so «Skriv ut» opens the dialog at once.
  useEffect(() => {
    prepareStickerSheet().catch(() => undefined);
  }, []);

  const print = useMutation({
    mutationFn: printStickerSheet,
    onError: () =>
      showErrorNotification({
        title: "Kunne ikke skrive ut",
        message: "Klistremerkene kunne ikke hentes. Prøv igjen.",
      }),
  });

  return (
    <Stack gap="lg">
      <Text size="sm">Én utskrift gir 400 nye unike IDer, hver med to like klistremerker.</Text>
      <Flex direction={{ base: "column", sm: "row" }} gap="lg" align="stretch">
        <BookStickerAnimation />
        <Stack gap="lg" justify="center" flex={1} py={{ sm: "xs" }}>
          <GuideStep step={1} title="Skriv ut">
            Trykk «Skriv ut» under og velg Brother QL-700. Hver ID kommer ut som én lapp med to like
            klistremerker.
          </GuideStep>
          <GuideStep step={2} title="Klistre på">
            Sett det ene klistremerket på første side i boka og det andre på baksiden.
          </GuideStep>
          <GuideStep step={3} title="Koble til bøker">
            Skann bokas ISBN og IDene her på Merking, slik at bøkene blir klare til utlevering.
          </GuideStep>
        </Stack>
      </Flex>
      <Group justify="flex-end">
        <Button
          leftSection={<IconPrinter size={18} aria-hidden />}
          loading={print.isPending}
          onClick={() => print.mutate()}
        >
          Skriv ut
        </Button>
      </Group>
    </Stack>
  );
}
