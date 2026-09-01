import { Container, Stack, Title } from "@mantine/core";
import SelectSubjects from "@/features/subjects/SelectSubjects";
import { createFileRoute } from "@tanstack/react-router";
import { seo } from "@/shared/utils/seo";

export const Route = createFileRoute("/(offentlig)/bestilling/$branchId")({
  head: () =>
    seo({
      title: "Bestill bøker | Boklisten.no",
      description:
        "Velg fagene du tar, så finner vi pensumbøkene som hører til. Du henter bøkene på stand ved skolen din, eller får dem tilsendt i posten.",
    }),
  component: SelectSubjectsPage,
});

function SelectSubjectsPage() {
  const { branchId } = Route.useParams();

  return (
    <Container size="md">
      <Stack gap="xs">
        <Title>Hvilke fag tar du?</Title>
        <SelectSubjects branchId={branchId} />
      </Stack>
    </Container>
  );
}
