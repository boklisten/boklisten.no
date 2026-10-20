import { Button, Flex, Group, Stack, Text } from "@mantine/core";
import { IconFileDownload } from "@tabler/icons-react";
import { useMutation } from "@tanstack/react-query";
import { useEffect } from "react";

import BookStickerAnimation from "@/features/merking/BookStickerAnimation";
import downloadStickerSheet, { prepareStickerSheet } from "@/features/merking/downloadStickerSheet";
import StepLabel from "@/features/merking/StepLabel";
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
 * and the button that downloads a sheet. Closing it lands on Merking, where the last step happens.
 */
export default function StickerGuide() {
  // Fetch a sheet while the guide is being read, so «Last ned PDF» starts the download at once.
  useEffect(() => {
    prepareStickerSheet().catch(() => undefined);
  }, []);

  const download = useMutation({
    mutationFn: downloadStickerSheet,
    onError: () =>
      showErrorNotification({
        title: "Klarte ikke laste ned",
        message: "Klistremerkene kunne ikke hentes. Prøv igjen.",
      }),
  });

  return (
    <Stack gap="lg">
      <Text size="sm">Én PDF inneholder 400 nye unike IDer.</Text>
      <Flex direction={{ base: "column", sm: "row" }} gap="lg" align="stretch">
        <BookStickerAnimation />
        <Stack gap="lg" justify="center" flex={1} py={{ sm: "xs" }}>
          <GuideStep step={1} title="Last ned og skriv ut">
            Trykk på «Last ned PDF», åpne filen og skriv den ut. Velg kutt etter hver andre side,
            slik at hver ID blir én lapp med to like klistremerker.
          </GuideStep>
          <GuideStep step={2} title="Klistre på">
            Sett det ene klistremerket på baksiden av boka og det andre på første side i omslaget.
          </GuideStep>
          <GuideStep step={3} title="Koble til bøker">
            Skann bokas ISBN og IDene her på Merking, slik at bøkene blir klare til utlevering.
          </GuideStep>
        </Stack>
      </Flex>
      <Group justify="flex-end">
        <Button
          leftSection={<IconFileDownload size={18} aria-hidden />}
          loading={download.isPending}
          onClick={() => download.mutate()}
        >
          Last ned PDF
        </Button>
      </Group>
    </Stack>
  );
}
