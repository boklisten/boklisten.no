import { CSVImporter, type Column, type ImportResult } from "@importcsv/react";
import {
  Alert,
  Badge,
  Button,
  Group,
  List,
  Modal,
  Select,
  Stack,
  Table,
  Text,
  Title,
} from "@mantine/core";
import { modals } from "@mantine/modals";
import { IconAlertTriangle, IconArrowRight, IconInfoCircle, IconUserUp } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import {
  normalizeNorwegianDate,
  normalizeNorwegianPhone,
} from "@/features/branches/csvNormalizers";
import useApiClient from "@/shared/hooks/useApiClient";
import { showErrorNotification, showSuccessNotification } from "@/shared/utils/notifications";

interface UserCandidate {
  name: string;
  phone: string;
  email: string;
  localName?: string;
  address?: string;
  postalCode?: string;
  postalCity?: string;
  dob?: string;
}

const IMPORT_COLUMNS: Column[] = [
  {
    id: "name",
    label: "Navn",
    description: "Fullt navn, f.eks. Kari Nordmann",
    validators: [{ type: "required", message: "Navn er påkrevd" }],
    transformations: [{ type: "trim" }],
  },
  {
    id: "phone",
    label: "Mobilnummer",
    description: "8 siffer uten +47, f.eks. 41234567",
    validators: [
      { type: "required", message: "Mobilnummer er påkrevd" },
      {
        type: "regex",
        pattern: "^[49]\\d{7}$",
        message: "Må være 8 siffer uten +47",
      },
    ],
    transformations: [{ type: "custom", fn: normalizeNorwegianPhone, stage: "pre" }],
  },
  {
    id: "email",
    label: "E-post",
    description: "F.eks. kari@eksempel.no",
    type: "email",
    validators: [{ type: "required", message: "E-post er påkrevd" }],
    transformations: [{ type: "trim" }, { type: "lowercase" }],
  },
  {
    id: "localName",
    label: "Klasse",
    description: "Valgfri. F.eks. 1STA",
    transformations: [{ type: "trim" }],
  },
  {
    id: "address",
    label: "Adresse",
    description: "Valgfri. F.eks. Osloveien 1",
    transformations: [{ type: "trim" }],
  },
  {
    id: "postalCode",
    label: "Postnummer",
    description: "Valgfri. 4 siffer, f.eks. 0563",
    validators: [{ type: "regex", pattern: "^(\\d{4})?$", message: "Må være 4 siffer" }],
    transformations: [{ type: "trim" }],
  },
  {
    id: "postalCity",
    label: "Poststed",
    description: "Valgfri. F.eks. Oslo",
    transformations: [{ type: "trim" }],
  },
  {
    id: "dob",
    label: "Fødselsdato",
    description: "Valgfri. Format åååå-mm-dd, f.eks. 2008-01-31",
    validators: [
      {
        type: "regex",
        pattern: "^(\\d{4}-\\d{2}-\\d{2})?$",
        message: "Må være på formatet åååå-mm-dd, f.eks. 2008-01-31",
      },
    ],
    transformations: [{ type: "custom", fn: normalizeNorwegianDate, stage: "pre" }],
  },
];

function cell(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  return value == null ? "" : String(value).trim();
}

function toUserCandidates(result: ImportResult): UserCandidate[] {
  return result.rows.map((row) => ({
    name: cell(row, "name"),
    phone: cell(row, "phone"),
    email: cell(row, "email"),
    localName: cell(row, "localName") || undefined,
    address: cell(row, "address") || undefined,
    postalCode: cell(row, "postalCode") || undefined,
    postalCity: cell(row, "postalCity") || undefined,
    dob: cell(row, "dob") || undefined,
  }));
}

function ProvisioningErrorsDialog({
  errors,
}: {
  errors: { name: string; email: string; message: string }[];
}) {
  return (
    <Stack>
      <Text>{`${errors.length} ${errors.length === 1 ? "elev" : "elever"} kunne ikke lagres:`}</Text>
      <List>
        {errors.map((error) => (
          <List.Item key={error.email}>
            {`${error.name} (${error.email}): ${error.message}`}
          </List.Item>
        ))}
      </List>
    </Stack>
  );
}

export default function UploadBranchUsers({ branchId }: { branchId: string }) {
  const { api, client } = useApiClient();
  const queryClient = useQueryClient();
  const [importerOpen, setImporterOpen] = useState(false);
  const [candidates, setCandidates] = useState<UserCandidate[] | null>(null);
  const [branchSelections, setBranchSelections] = useState<Record<string, string>>({});

  const evaluateMutation = useMutation({
    mutationFn: async (userCandidates: UserCandidate[]) =>
      client.api.userProvisioning.evaluate({
        params: { branchId },
        body: { userCandidates },
      }),
    onError: () => {
      setCandidates(null);
      showErrorNotification("Klarte ikke å evaluere elevlisten!");
    },
  });

  const provisionMutation = useMutation({
    mutationFn: async ({
      userCandidates,
      branchResolutions,
    }: {
      userCandidates: UserCandidate[];
      branchResolutions: { localName: string; branchId: string }[];
    }) =>
      client.api.userProvisioning.provision({
        params: { branchId },
        body: { userCandidates, branchResolutions },
      }),
    onSuccess: (summary) => {
      closeEvaluation();
      showSuccessNotification(
        `${summary.createdCount} ${summary.createdCount === 1 ? "elev" : "elever"} opprettet og ${summary.updatedCount} oppdatert`,
      );
      if (summary.errors.length > 0) {
        modals.open({
          title: "Noen elever kunne ikke lagres",
          children: <ProvisioningErrorsDialog errors={summary.errors} />,
        });
      }
    },
    onError: () => showErrorNotification("Klarte ikke å laste opp elevene!"),
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: api.branchMembership.getMembers.queryKey(),
      }),
  });

  function closeEvaluation() {
    setCandidates(null);
    setBranchSelections({});
    evaluateMutation.reset();
  }

  const evaluation = evaluateMutation.data;
  const ambiguousMappings =
    evaluation?.mappings.filter((mapping) => mapping.status === "ambiguous") ?? [];
  const unmatchedMappings = evaluation?.mappings.filter(
    (mapping) => mapping.status === "unmatched",
  );
  const confirmBlocked = (unmatchedMappings?.length ?? 0) > 0;
  const candidatesWithoutClass =
    candidates?.filter((candidate) => !candidate.localName).length ?? 0;

  function selectedBranchId(mapping: (typeof ambiguousMappings)[number]) {
    return branchSelections[mapping.localName] ?? mapping.candidates[0]?.id ?? null;
  }

  function confirmProvisioning(userCandidates: UserCandidate[]) {
    provisionMutation.mutate({
      userCandidates,
      branchResolutions: ambiguousMappings.flatMap((mapping) => {
        const resolvedBranchId = selectedBranchId(mapping);
        return resolvedBranchId
          ? [{ localName: mapping.localName, branchId: resolvedBranchId }]
          : [];
      }),
    });
  }

  return (
    <Stack gap={"xs"}>
      <Title order={4}>Last opp elever</Title>
      <Text size={"sm"} c={"dimmed"}>
        Last opp en elevliste (CSV eller Excel). Nye elever får konto og velkomstmelding,
        eksisterende elever får kun oppdatert informasjonen sin.
      </Text>
      <Group>
        <Button
          leftSection={<IconUserUp />}
          onClick={() => setImporterOpen(true)}
          loading={evaluateMutation.isPending}
        >
          Last opp elevliste
        </Button>
      </Group>
      <CSVImporter
        columns={IMPORT_COLUMNS}
        isModal
        modalIsOpen={importerOpen}
        modalOnCloseTriggered={() => setImporterOpen(false)}
        primaryColor={"#26768f"}
        onComplete={(result) => {
          setImporterOpen(false);
          const userCandidates = toUserCandidates(result);
          if (userCandidates.length === 0) {
            showErrorNotification("Filen inneholder ingen elever!");
            return;
          }
          setCandidates(userCandidates);
          setBranchSelections({});
          evaluateMutation.mutate(userCandidates);
        }}
      />
      <Modal
        opened={evaluation !== undefined && candidates !== null}
        onClose={closeEvaluation}
        title={"Bekreft opplasting av elever"}
        size={"lg"}
      >
        {evaluation && candidates && (
          <Stack>
            <Text>
              {`${evaluation.createCount} ${evaluation.createCount === 1 ? "ny elev" : "nye elever"} opprettes og ${evaluation.updateCount} ${evaluation.updateCount === 1 ? "eksisterende elev" : "eksisterende elever"} oppdateres.`}
            </Text>
            {candidatesWithoutClass > 0 && (
              <Text size={"sm"} c={"dimmed"}>
                {`${candidatesWithoutClass} ${candidatesWithoutClass === 1 ? "elev" : "elever"} mangler klasse i filen og lastes opp uten klasse. Eksisterende elever beholder klassen sin.`}
              </Text>
            )}
            {evaluation.mappings.length > 0 && (
              <>
                <Title order={5}>Klassene i filen blir til disse filialene</Title>
                <Table.ScrollContainer minWidth={350}>
                  <Table>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Klasse i filen</Table.Th>
                        <Table.Th />
                        <Table.Th>Filial</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {evaluation.mappings.map((mapping) => (
                        <Table.Tr key={mapping.localName}>
                          <Table.Td>{mapping.localName}</Table.Td>
                          <Table.Td>
                            <IconArrowRight size={16} />
                          </Table.Td>
                          <Table.Td>
                            {mapping.status === "matched" && mapping.branch?.name}
                            {mapping.status === "ambiguous" && (
                              <Select
                                aria-label={`Velg filial for ${mapping.localName}`}
                                data={mapping.candidates.map((candidate) => ({
                                  value: candidate.id,
                                  label: candidate.name,
                                }))}
                                value={selectedBranchId(mapping)}
                                onChange={(nextBranchId) =>
                                  nextBranchId &&
                                  setBranchSelections((selections) => ({
                                    ...selections,
                                    [mapping.localName]: nextBranchId,
                                  }))
                                }
                                allowDeselect={false}
                              />
                            )}
                            {mapping.status === "unmatched" && (
                              <Badge color={"red"} variant={"light"}>
                                Ikke funnet
                              </Badge>
                            )}
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Table.ScrollContainer>
              </>
            )}
            {ambiguousMappings.length > 0 && (
              <Alert
                color={"blue"}
                icon={<IconInfoCircle />}
                title={"Noen klasser passer med flere filialer"}
              >
                Vi har foreslått den filialen som ligner mest. Kontroller at valgene i tabellen
                stemmer før du bekrefter.
              </Alert>
            )}
            {confirmBlocked && (
              <Alert
                color={"red"}
                icon={<IconAlertTriangle />}
                title={"Noen klasser mangler filial"}
              >
                Noen av klassene i filen passer ikke med noen filial under denne filialen. Rett opp
                klassenavnene i filen eller filialstrukturen, og last opp listen på nytt.
              </Alert>
            )}
            <Group justify={"flex-end"}>
              <Button variant={"default"} onClick={closeEvaluation}>
                Avbryt
              </Button>
              <Button
                disabled={confirmBlocked}
                loading={provisionMutation.isPending}
                onClick={() => confirmProvisioning(candidates)}
              >
                Bekreft opplasting
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}
