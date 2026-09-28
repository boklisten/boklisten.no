import { Accordion, Badge, Button, Group, Skeleton, Stack, Text } from "@mantine/core";
import { modals } from "@mantine/modals";
import { IconPlus } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { Activity, useState } from "react";

import BranchSubjectEditor from "@/features/branches/subjects/BranchSubjectEditor";
import { BranchSubjectModal } from "@/features/branches/subjects/BranchSubjectModal";
import type { BranchSubject } from "@/features/branches/subjects/subjectOptions";
import ErrorAlert from "@/shared/components/alerts/ErrorAlert";
import InfoAlert from "@/shared/components/alerts/InfoAlert";
import { api } from "@/shared/utils/apiClient";
import { PLEASE_TRY_AGAIN_TEXT } from "@/shared/utils/constants";

function bookCountLabel(count: number) {
  if (count === 0) {
    return "Ingen bøker";
  }
  return count === 1 ? "1 bok" : `${count} bøker`;
}

export default function BranchSubjectSettings({ branchId }: { branchId: string }) {
  const {
    data: subjects,
    isLoading,
    isError,
  } = useQuery(api.branchSubjects.index.queryOptions({ params: { branchId } }));

  // A snapshot taken on open, so refetches do not reach the editor while it is open.
  const [openSubject, setOpenSubject] = useState<BranchSubject | null>(null);

  const modalId = "branch-subject-create";
  function openCreateModal() {
    modals.open({
      modalId,
      title: "Nytt fag",
      children: <BranchSubjectModal branchId={branchId} modalId={modalId} />,
    });
  }

  return (
    <Stack>
      <Group>
        <Button leftSection={<IconPlus />} onClick={openCreateModal}>
          Nytt fag
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
        <Accordion
          variant="separated"
          value={openSubject === null ? null : String(openSubject.id)}
          onChange={(value) =>
            setOpenSubject(subjects?.find((subject) => String(subject.id) === value) ?? null)
          }
        >
          {subjects?.map((subject) => (
            <Accordion.Item key={subject.id} value={String(subject.id)}>
              <Accordion.Control>
                <Group justify="space-between" pr="md">
                  <Stack gap={0}>
                    <Text fw={600}>{subject.name}</Text>
                    {subject.externalName !== null && (
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
                {openSubject?.id === subject.id && (
                  <BranchSubjectEditor branchId={branchId} subject={openSubject} />
                )}
              </Accordion.Panel>
            </Accordion.Item>
          ))}
        </Accordion>
      )}
    </Stack>
  );
}
