import { CSVImporter } from "@importcsv/react";
import type { Column, ImportResult } from "@importcsv/react";
import {
  Alert,
  Button,
  Group,
  List,
  Modal,
  Paper,
  ScrollArea,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import {
  IconAlertTriangle,
  IconBookUpload,
  IconCircleCheck,
  IconInfoCircle,
  IconUserQuestion,
} from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useState } from "react";

import { normalizeNorwegianDate } from "@/features/branches/csvNormalizers";
import useApiClient from "@/shared/hooks/useApiClient";
import { showErrorNotification } from "@/shared/utils/notifications";

interface SubjectChoiceRow {
  name: string;
  localName: string;
  subject: string;
  deadline: string;
}

interface UploadReport {
  metrics: {
    studentsWithOrders: number;
    totalBooks: number;
    skippedAlreadyOwned: number;
    studentsAlreadyCovered: number;
  };
  unknownSubjects: { subject: string; studentCount: number }[];
  unknownUsers: { name: string; localName: string }[];
  ambiguousUsers: { name: string; localName: string; matchCount: number }[];
}

const IMPORT_COLUMNS: Column[] = [
  {
    id: "name",
    label: "Navn",
    description: "Elevens fulle navn, f.eks. Kari Nordmann",
    validators: [{ type: "required", message: "Navn er påkrevd" }],
    transformations: [{ type: "trim" }],
  },
  {
    id: "localName",
    label: "Klasse",
    description: "F.eks. 3STA",
    validators: [{ type: "required", message: "Klasse er påkrevd" }],
    transformations: [{ type: "trim" }],
  },
  {
    id: "subject",
    label: "Fagnavn",
    description: "Ett fag per rad, f.eks. Kjemi 2",
    validators: [{ type: "required", message: "Fagnavn er påkrevd" }],
    transformations: [{ type: "trim" }],
  },
  {
    id: "deadline",
    label: "Frist",
    description:
      "Fristen for bøkene i faget, må være i fremtiden. Format åååå-mm-dd eller dd.mm.åååå",
    validators: [
      { type: "required", message: "Frist er påkrevd" },
      {
        type: "regex",
        pattern: "^\\d{4}-\\d{2}-\\d{2}$",
        message: "Må være en dato, f.eks. 2027-07-01 eller 01.07.2027",
      },
    ],
    transformations: [{ type: "custom", fn: normalizeNorwegianDate, stage: "pre" }],
  },
];

function localTodayISO(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

function findPastDeadlines(rows: SubjectChoiceRow[]): string[] {
  const today = localTodayISO();
  return [
    ...new Set(rows.map((row) => row.deadline).filter((deadline) => deadline <= today)),
  ].toSorted();
}

function isRealDate(deadline: string): boolean {
  // new Date() rolls invalid days over (2027-02-30 → March 2nd), so round-trip to detect it
  const parsed = new Date(`${deadline}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === deadline;
}

function findInvalidDeadlines(rows: SubjectChoiceRow[]): string[] {
  return [
    ...new Set(rows.map((row) => row.deadline).filter((deadline) => !isRealDate(deadline))),
  ].toSorted();
}

function cell(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  return value == null ? "" : String(value).trim();
}

function toSubjectChoiceRows(result: ImportResult): SubjectChoiceRow[] {
  return result.rows
    .map((row) => ({
      name: cell(row, "name"),
      localName: cell(row, "localName"),
      subject: cell(row, "subject"),
      deadline: cell(row, "deadline"),
    }))
    .filter((row) => row.name && row.localName && row.subject && row.deadline);
}

function Metric({
  value,
  label,
  labelSingular,
}: {
  value: number;
  label: string;
  labelSingular: string;
}) {
  return (
    <Paper withBorder p="sm" radius="md">
      <Text fw={700} fz="xl" lh={1.2}>
        {value}
      </Text>
      <Text size="xs" c="dimmed">
        {value === 1 ? labelSingular : label}
      </Text>
    </Paper>
  );
}

function ProblemAlert({
  color,
  icon,
  title,
  children,
}: {
  color: string;
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <Alert color={color} icon={icon} title={title}>
      <ScrollArea.Autosize mah={180}>{children}</ScrollArea.Autosize>
    </Alert>
  );
}

function ReportProblems({ report }: { report: UploadReport }) {
  return (
    <>
      {report.unknownSubjects.length > 0 && (
        <ProblemAlert
          color="yellow"
          icon={<IconAlertTriangle />}
          title={`${report.unknownSubjects.length} fag finnes ikke på filialen og hoppes over`}
        >
          <List size="sm">
            {report.unknownSubjects.map(({ subject, studentCount }) => (
              <List.Item key={subject}>
                {`${subject} – ${studentCount} ${studentCount === 1 ? "elev" : "elever"}`}
              </List.Item>
            ))}
          </List>
        </ProblemAlert>
      )}
      {report.unknownUsers.length > 0 && (
        <ProblemAlert
          color="red"
          icon={<IconUserQuestion />}
          title={`${report.unknownUsers.length} ${report.unknownUsers.length === 1 ? "elev" : "elever"} ble ikke funnet og hoppes over`}
        >
          <List size="sm">
            {report.unknownUsers.map(({ name, localName }) => (
              <List.Item key={`${name}|${localName}`}>{`${name} (${localName})`}</List.Item>
            ))}
          </List>
        </ProblemAlert>
      )}
      {report.ambiguousUsers.length > 0 && (
        <ProblemAlert
          color="blue"
          icon={<IconInfoCircle />}
          title={`${report.ambiguousUsers.length} navn passer med flere elever og hoppes over`}
        >
          <List size="sm">
            {report.ambiguousUsers.map(({ name, localName, matchCount }) => (
              <List.Item key={`${name}|${localName}`}>
                {`${name} (${localName}) – ${matchCount} elever med dette navnet. Bestill bøkene deres manuelt.`}
              </List.Item>
            ))}
          </List>
        </ProblemAlert>
      )}
    </>
  );
}

export default function UploadSubjectChoices({
  branchId,
  branchName,
}: {
  branchId: string;
  branchName: string;
}) {
  const { api, client } = useApiClient();
  const queryClient = useQueryClient();
  const [importerOpen, setImporterOpen] = useState(false);
  const [rows, setRows] = useState<SubjectChoiceRow[] | null>(null);

  const evaluateMutation = useMutation({
    mutationFn: async (subjectChoiceRows: SubjectChoiceRow[]) =>
      client.api.branchUpload.evaluateSubjectChoices({
        params: { branchId },
        body: { rows: subjectChoiceRows },
      }),
    onError: () => {
      setRows(null);
      showErrorNotification("Klarte ikke å evaluere fagvalgene!");
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (subjectChoiceRows: SubjectChoiceRow[]) =>
      client.api.branchUpload.uploadSubjectChoices({
        params: { branchId },
        body: { rows: subjectChoiceRows },
      }),
    onError: () => showErrorNotification("Klarte ikke å opprette bestillingene!"),
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: api.branchBooks.getOrderedBooks.queryKey(),
      }),
  });

  function closeEvaluation() {
    setRows(null);
    evaluateMutation.reset();
  }

  function closeResult() {
    closeEvaluation();
    uploadMutation.reset();
  }

  const evaluation = evaluateMutation.data;
  const result = uploadMutation.data;

  return (
    <Stack gap="xs">
      <Title order={4}>Last opp fagvalg</Title>
      <Text size="sm" c="dimmed">
        Last opp en liste med fagvalg (CSV eller Excel) med én rad per fag per elev: navn, klasse,
        fagnavn og frist. Elevene får bestilling på bøkene i fagene sine – bøker de allerede har
        eller venter på, hoppes over.
      </Text>
      <Group>
        <Button
          leftSection={<IconBookUpload />}
          onClick={() => setImporterOpen(true)}
          loading={evaluateMutation.isPending}
        >
          Last opp fagvalg
        </Button>
      </Group>
      <CSVImporter
        columns={IMPORT_COLUMNS}
        isModal
        modalIsOpen={importerOpen}
        modalOnCloseTriggered={() => setImporterOpen(false)}
        primaryColor="#26768f"
        onComplete={(importResult) => {
          setImporterOpen(false);
          const subjectChoiceRows = toSubjectChoiceRows(importResult);
          if (subjectChoiceRows.length === 0) {
            showErrorNotification("Filen inneholder ingen fagvalg!");
            return;
          }
          const invalidDeadlines = findInvalidDeadlines(subjectChoiceRows);
          if (invalidDeadlines.length > 0) {
            showErrorNotification(`Ugyldig frist: ${invalidDeadlines.join(", ")}`);
            return;
          }
          const pastDeadlines = findPastDeadlines(subjectChoiceRows);
          if (pastDeadlines.length > 0) {
            showErrorNotification(`Fristen må være i fremtiden: ${pastDeadlines.join(", ")}`);
            return;
          }
          setRows(subjectChoiceRows);
          evaluateMutation.mutate(subjectChoiceRows);
        }}
      />
      <Modal
        opened={evaluation !== undefined && rows !== null && result === undefined}
        onClose={closeEvaluation}
        title="Bekreft bestillinger"
        size="lg"
      >
        {evaluation && rows && (
          <Stack>
            <Text size="sm" c="dimmed">
              {`Elever og fag hentes fra ${branchName}. Hver bestilling knyttes til filialen der fagets bøker ligger.`}
            </Text>
            <SimpleGrid cols={{ base: 2, xs: 4 }} spacing="xs">
              <Metric
                value={evaluation.metrics.studentsWithOrders}
                label="elever får bestilling"
                labelSingular="elev får bestilling"
              />
              <Metric
                value={evaluation.metrics.totalBooks}
                label="bøker bestilles"
                labelSingular="bok bestilles"
              />
              <Metric
                value={evaluation.metrics.skippedAlreadyOwned}
                label="bøker hoppes over (har eller venter på boken)"
                labelSingular="bok hoppes over (har eller venter på boken)"
              />
              <Metric
                value={evaluation.metrics.studentsAlreadyCovered}
                label="elever har alt fra før"
                labelSingular="elev har alt fra før"
              />
              {evaluation.metrics.choicesWithoutBooks > 0 && (
                <Metric
                  value={evaluation.metrics.choicesWithoutBooks}
                  label="fagvalg gjelder fag uten bøker"
                  labelSingular="fagvalg gjelder fag uten bøker"
                />
              )}
            </SimpleGrid>
            <ReportProblems report={evaluation} />
            {evaluation.metrics.studentsWithOrders === 0 && (
              <Alert color="gray" icon={<IconInfoCircle />}>
                Ingen nye bestillinger å opprette. Rett opp listen og last den opp på nytt.
              </Alert>
            )}
            <Group justify="flex-end">
              <Button variant="default" onClick={closeEvaluation}>
                Avbryt
              </Button>
              <Button
                disabled={evaluation.metrics.studentsWithOrders === 0}
                loading={uploadMutation.isPending}
                onClick={() => uploadMutation.mutate(rows)}
              >
                {`Opprett bestillinger for ${evaluation.metrics.studentsWithOrders} ${evaluation.metrics.studentsWithOrders === 1 ? "elev" : "elever"}`}
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
      <Modal
        opened={result !== undefined}
        onClose={closeResult}
        title="Bestillinger opprettet"
        size="lg"
      >
        {result && (
          <Stack>
            <Alert color="green" icon={<IconCircleCheck />}>
              {`${result.booksOrdered} ${result.booksOrdered === 1 ? "bok" : "bøker"} ble bestilt fordelt på ${result.metrics.studentsWithOrders} ${result.metrics.studentsWithOrders === 1 ? "elev" : "elever"}.`}
            </Alert>
            <SimpleGrid cols={{ base: 2, xs: 4 }} spacing="xs">
              <Metric
                value={result.ordersCreated}
                label="bestillinger opprettet"
                labelSingular="bestilling opprettet"
              />
              <Metric
                value={result.booksOrdered}
                label="bøker bestilt"
                labelSingular="bok bestilt"
              />
              <Metric
                value={result.metrics.skippedAlreadyOwned}
                label="bøker hoppet over (hadde eller ventet på boken)"
                labelSingular="bok hoppet over (hadde eller ventet på boken)"
              />
              <Metric
                value={result.metrics.studentsAlreadyCovered}
                label="elever hadde alt fra før"
                labelSingular="elev hadde alt fra før"
              />
              {result.metrics.choicesWithoutBooks > 0 && (
                <Metric
                  value={result.metrics.choicesWithoutBooks}
                  label="fagvalg gjaldt fag uten bøker"
                  labelSingular="fagvalg gjaldt fag uten bøker"
                />
              )}
            </SimpleGrid>
            <ReportProblems report={result} />
            {result.errors.length > 0 && (
              <ProblemAlert
                color="red"
                icon={<IconAlertTriangle />}
                title={`${result.errors.length} ${result.errors.length === 1 ? "bestilling" : "bestillinger"} feilet`}
              >
                <List size="sm">
                  {result.errors.map(({ customerName, message }) => (
                    <List.Item key={`${customerName}|${message}`}>
                      {`${customerName}: ${message}`}
                    </List.Item>
                  ))}
                </List>
              </ProblemAlert>
            )}
            <Group justify="flex-end">
              <Button onClick={closeResult}>Lukk</Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}
