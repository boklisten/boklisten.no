import { Container, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { createFileRoute } from "@tanstack/react-router";

import BookCard from "@/features/merking/BookCard";
import RegistrationConfirm from "@/features/merking/RegistrationConfirm";
import ScannedBlidList from "@/features/merking/ScannedBlidList";
import { MERKING_DESCRIPTION, MERKING_TITLE } from "@/features/merking/merkingDescription";
import useBlidRegistrationSession from "@/features/merking/useBlidRegistrationSession";
import useWedgeScanner from "@/shared/hooks/useWedgeScanner";
import { showErrorNotification } from "@/shared/utils/notifications";
import { seo } from "@/shared/utils/seo";

export const Route = createFileRoute("/(administrasjon)/admin/merking")({
  head: () =>
    seo({
      title: `${MERKING_TITLE} | bl-admin`,
    }),
  component: MerkingPage,
});

/** Scan a book's ISBN, then every unique-ID sticker going onto copies of it, then confirm. */
function MerkingPage() {
  const session = useBlidRegistrationSession();

  /** The physical scanner has no notice UI of its own, so a code that led nowhere becomes a toast. */
  async function scan(code: string) {
    const notice = await session.submitCode(code);
    if (notice) {
      showErrorNotification({ title: notice.title, message: notice.message });
    }
  }
  useWedgeScanner({ accepts: ["isbn", "blid"], onScan: (code) => void scan(code) });

  return (
    <Container>
      <Stack>
        <Stack gap={4}>
          <Title>{MERKING_TITLE}</Title>
          <Text c="dimmed">{MERKING_DESCRIPTION}</Text>
        </Stack>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <BookCard book={session.book} onClear={session.clearBook} />
          <ScannedBlidList
            rows={session.rows}
            book={session.book}
            receipt={session.receipt}
            onRemove={session.removeRow}
            onDismissReceipt={session.dismissReceipt}
          />
        </SimpleGrid>
        <RegistrationConfirm
          rows={session.rows}
          book={session.book}
          loading={session.isRegistering}
          onConfirm={session.register}
        />
      </Stack>
    </Container>
  );
}
