import { Accordion, Badge, Button, Group, Skeleton, Stack, Text } from "@mantine/core";
import { modals } from "@mantine/modals";
import { IconFileImport, IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity } from "react";

import { BranchSubjectModal } from "@/features/branches/subjects/BranchSubjectModal";
import { describeOptions } from "@/features/branches/subjects/subjectOptions";
import type { BranchSubject } from "@/features/branches/subjects/subjectOptions";
import ErrorAlert from "@/shared/components/alerts/ErrorAlert";
import InfoAlert from "@/shared/components/alerts/InfoAlert";
import useApiClient from "@/shared/hooks/useApiClient";
import { PLEASE_TRY_AGAIN_TEXT } from "@/shared/utils/constants";
import { showErrorNotification, showSuccessNotification } from "@/shared/utils/notifications";

function bookCountLabel(count: number) {
  if (count === 0) {
    return "Ingen bøker";
  }
  return count === 1 ? "1 bok" : `${count} bøker`;
}

export default function BranchSubjectSettings({ branchId }: { branchId: string }) {
  const { api } = useApiClient();
  const queryClient = useQueryClient();
  const {
    data: subjects,
    isLoading,
    isError,
  } = useQuery(api.branchSubjects.getSubjects.queryOptions({ params: { branchId } }));

  const invalidateSubjects = () =>
    queryClient.invalidateQueries({
      queryKey: api.branchSubjects.getSubjects.pathKey(),
    });

  const importMutation = useMutation(
    api.branchSubjects.importSubjects.mutationOptions({
      onSuccess: ({ createdSubjects, skippedExisting }) => {
        const skippedText = skippedExisting > 0 ? ` (${skippedExisting} fantes fra før)` : "";
        showSuccessNotification(`Importerte ${createdSubjects} fag${skippedText}`);
      },
      onError: () => showErrorNotification("Klarte ikke importere fagene"),
      onSettled: invalidateSubjects,
    }),
  );

  const deleteMutation = useMutation(
    api.branchSubjects.deleteSubject.mutationOptions({
      onSuccess: () => showSuccessNotification("Faget ble slettet!"),
      onError: () => showErrorNotification("Klarte ikke slette faget"),
      onSettled: invalidateSubjects,
    }),
  );

  const modalId = "branch-subject-editor";
  function openSubjectModal(existingSubject?: BranchSubject) {
    modals.open({
      modalId,
      title: existingSubject ? "Rediger fag" : "Nytt fag",
      children: (
        <BranchSubjectModal
          branchId={branchId}
          modalId={modalId}
          existingSubject={existingSubject}
        />
      ),
    });
  }

  function confirmDelete(subject: BranchSubject) {
    modals.openConfirmModal({
      title: "Slett fag",
      children: (
        <Text size="sm">
          Er du sikker på at du vil slette faget «{subject.name}»? Dette påvirker ikke bøkene i
          Bøker-fanen.
        </Text>
      ),
      labels: { confirm: "Slett", cancel: "Avbryt" },
      confirmProps: { color: "red" },
      onConfirm: () =>
        deleteMutation.mutate({ params: { branchId, subjectId: String(subject.id) } }),
    });
  }

  return (
    <Stack>
      <Group>
        <Button leftSection={<IconPlus />} onClick={() => openSubjectModal()}>
          Nytt fag
        </Button>
        <Button
          variant="outline"
          leftSection={<IconFileImport />}
          loading={importMutation.isPending}
          onClick={() => importMutation.mutate({ params: { branchId } })}
        >
          Importer fra bøker
        </Button>
      </Group>
      <Activity mode={isLoading ? "visible" : "hidden"}>
        <Skeleton height={60} />
        <Skeleton height={60} />
        <Skeleton height={60} />
        <Skeleton height={60} />
        <Skeleton height={60} />
      </Activity>
      <Activity mode={!isLoading && (isError || subjects === undefined) ? "visible" : "hidden"}>
        <ErrorAlert title="Klarte ikke laste inn fagene">{PLEASE_TRY_AGAIN_TEXT}</ErrorAlert>
      </Activity>
      {subjects?.length === 0 && (
        <InfoAlert title="Ingen fag">
          Denne filialen har ingen fag ennå. Legg til fag manuelt, eller importer dem fra fagene som
          er satt på bøkene i Bøker-fanen.
        </InfoAlert>
      )}
      {(subjects?.length ?? 0) > 0 && (
        <Accordion variant="separated">
          {subjects?.map((subject) => (
            <Accordion.Item key={subject.id} value={String(subject.id)}>
              <Accordion.Control>
                <Group justify="space-between" pr="md">
                  <Stack gap={0}>
                    <Text fw={600}>{subject.name}</Text>
                    {subject.externalName !== subject.name && (
                      <Text size="xs" c="dimmed">
                        Lastes opp som «{subject.externalName}»
                      </Text>
                    )}
                  </Stack>
                  <Badge variant="light" color={subject.books.length === 0 ? "gray" : "blue"}>
                    {bookCountLabel(subject.books.length)}
                  </Badge>
                </Group>
              </Accordion.Control>
              <Accordion.Panel>
                <Stack gap="sm">
                  {subject.books.length === 0 && (
                    <Text size="sm" c="dimmed">
                      Faget har ingen bøker. Fagvalg med dette faget blir godkjent uten bestilling
                      når fagvalg lastes opp.
                    </Text>
                  )}
                  {subject.books.map((book) => {
                    const options = describeOptions(book);
                    return (
                      <Stack key={book.item.id} gap={0}>
                        <Text size="sm" fw={500}>
                          {book.item.title}
                        </Text>
                        <Text size="xs" c="dimmed">
                          Bestilling: {options.ordering} — På filial: {options.atBranch}
                        </Text>
                      </Stack>
                    );
                  })}
                  <Group>
                    <Button size="xs" variant="light" onClick={() => openSubjectModal(subject)}>
                      Rediger
                    </Button>
                    <Button
                      size="xs"
                      variant="light"
                      color="red"
                      onClick={() => confirmDelete(subject)}
                    >
                      Slett
                    </Button>
                  </Group>
                </Stack>
              </Accordion.Panel>
            </Accordion.Item>
          ))}
        </Accordion>
      )}
    </Stack>
  );
}
