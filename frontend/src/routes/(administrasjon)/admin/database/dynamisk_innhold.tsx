import { Stack, Title } from "@mantine/core";
import EditableTextTable from "@/features/editable-texts/EditableTextTable";
import QuestionsAndAnswersTable from "@/features/questions-and-answers/QuestionsAndAnswersTable";
import { createFileRoute } from "@tanstack/react-router";
import { seo } from "@/shared/utils/seo";

export const Route = createFileRoute("/(administrasjon)/admin/database/dynamisk_innhold")({
  head: () =>
    seo({
      title: "Dynamisk innhold | bl-admin",
    }),
  component: EditableTextPage,
});

function EditableTextPage() {
  return (
    <Stack gap="xl">
      <Title>Dynamisk innhold</Title>
      <Stack gap="xs">
        <Title order={2}>Tekst</Title>
        <EditableTextTable />
      </Stack>
      <Stack gap="xs">
        <Title order={2}>Spørsmål og svar</Title>
        <QuestionsAndAnswersTable />
      </Stack>
    </Stack>
  );
}
