import type { Item } from "@boklisten/backend/shared/item";
import { CSVImporter } from "@importcsv/react";
import { Alert, Button, Group, List, Modal, ScrollArea, Stack, Text } from "@mantine/core";
import { modals } from "@mantine/modals";
import { IconAlertTriangle, IconUpload } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { BOOK_IMPORT_COLUMNS, toBookRows } from "@/features/book-management/bookSpreadsheet";
import type { BookRow } from "@/features/book-management/bookSpreadsheet";
import { api, apiClient } from "@/shared/utils/apiClient";
import { bookCountLabel } from "@/shared/utils/bookCountLabel";
import { errorMessage } from "@/shared/utils/errorMessage";
import { showErrorNotification, showSuccessNotification } from "@/shared/utils/notifications";

function duplicates<T>(values: T[]): T[] {
  const seen = new Set<T>();
  const repeated = new Set<T>();
  for (const value of values) {
    if (seen.has(value)) {
      repeated.add(value);
    }
    seen.add(value);
  }
  return [...repeated];
}

/**
 * Mirrors the backend's matching rule: a row with an id updates that book, a row without one
 * updates the book with the same ISBN or creates a new one.
 */
function previewUpload(rows: BookRow[], items: Item[]) {
  const knownIds = new Set(items.map((item) => item.id));
  const knownIsbns = new Set(items.map((item) => item.isbn));
  const unknownIds = rows.filter((row) => row.id !== undefined && !knownIds.has(row.id));
  const newBooks = rows.filter(
    (row) => row.id === undefined && (row.isbn === null || !knownIsbns.has(row.isbn)),
  );
  return {
    unknownIds,
    newBooks,
    updateCount: rows.length - newBooks.length - unknownIds.length,
    duplicateIsbns: duplicates(rows.flatMap((row) => (row.isbn === null ? [] : [row.isbn]))),
    duplicateIds: duplicates(rows.flatMap((row) => (row.id === undefined ? [] : [row.id]))),
  };
}

function UploadErrorsDialog({
  errors,
}: {
  errors: { isbn: number | null; title: string; message: string }[];
}) {
  return (
    <Stack>
      <Text>{`${bookCountLabel(errors.length)} kunne ikke lagres:`}</Text>
      <List>
        {errors.map((error, index) => (
          <List.Item
            // oxlint-disable-next-line react/no-array-index-key -- errors have no id; a book without an ISBN has no other key
            key={index}
          >{`${error.title}${error.isbn === null ? "" : ` (${error.isbn})`}: ${error.message}`}</List.Item>
        ))}
      </List>
    </Stack>
  );
}

export default function BookUpload({ items }: { items: Item[] }) {
  const queryClient = useQueryClient();
  const [importerOpen, setImporterOpen] = useState(false);
  const [rows, setRows] = useState<BookRow[] | null>(null);

  const uploadMutation = useMutation({
    mutationFn: (books: BookRow[]) => apiClient.api.items.bulkUpsert({ body: { items: books } }),
    onSuccess: (summary) => {
      setRows(null);
      showSuccessNotification(
        `${bookCountLabel(summary.updatedCount)} oppdatert og ${summary.createdCount} ${summary.createdCount === 1 ? "ny" : "nye"} opprettet`,
      );
      if (summary.errors.length > 0) {
        modals.open({
          title: "Noen bøker kunne ikke lagres",
          children: <UploadErrorsDialog errors={summary.errors} />,
        });
      }
    },
    onError: (error) => showErrorNotification(errorMessage(error, "Klarte ikke laste opp bøkene")),
    onSettled: () => queryClient.invalidateQueries({ queryKey: api.items.all.queryKey() }),
  });

  const preview = previewUpload(rows ?? [], items);
  const blockers = [
    ...(preview.duplicateIsbns.length > 0
      ? [`Filen inneholder ISBN ${preview.duplicateIsbns.join(", ")} på mer enn én rad.`]
      : []),
    ...(preview.duplicateIds.length > 0
      ? [`Filen inneholder id ${preview.duplicateIds.join(", ")} på mer enn én rad.`]
      : []),
    ...(preview.unknownIds.length > 0
      ? [
          `Ingen bok har id ${preview.unknownIds.map((row) => row.id).join(", ")}. Tøm id-cellen hvis boken skal opprettes på nytt.`,
        ]
      : []),
  ];

  return (
    <>
      <Button
        variant="default"
        leftSection={<IconUpload size={18} />}
        onClick={() => setImporterOpen(true)}
      >
        Last opp
      </Button>
      <CSVImporter
        columns={BOOK_IMPORT_COLUMNS}
        isModal
        modalIsOpen={importerOpen}
        modalOnCloseTriggered={() => setImporterOpen(false)}
        primaryColor="#26768f"
        onComplete={(result) => {
          setImporterOpen(false);
          const bookRows = toBookRows(result);
          if (bookRows.length === 0) {
            showErrorNotification("Filen inneholder ingen bøker!");
            return;
          }
          setRows(bookRows);
        }}
      />
      <Modal
        opened={rows !== null}
        onClose={() => setRows(null)}
        title="Bekreft opplasting av bøker"
        size="lg"
      >
        {rows && (
          <Stack>
            <Text>
              {`${bookCountLabel(preview.updateCount)} som finnes fra før overskrives med innholdet i filen, og ${bookCountLabel(preview.newBooks.length)} opprettes.`}
            </Text>
            {preview.newBooks.length > 0 && (
              <Stack gap={4}>
                <Text size="sm" c="dimmed">
                  Nye bøker. Sjekk at ingen av dem er skrivefeil i ISBN til en bok som finnes fra
                  før.
                </Text>
                <ScrollArea.Autosize mah={240}>
                  <List size="sm">
                    {preview.newBooks.map((book) => (
                      <List.Item key={book.isbn ?? book.title}>
                        {book.isbn === null ? book.title : `${book.title} (${book.isbn})`}
                      </List.Item>
                    ))}
                  </List>
                </ScrollArea.Autosize>
              </Stack>
            )}
            {blockers.length > 0 && (
              <Alert color="red" icon={<IconAlertTriangle />} title="Filen må rettes">
                <Stack gap={4}>
                  {blockers.map((blocker) => (
                    <Text key={blocker} size="sm">
                      {blocker}
                    </Text>
                  ))}
                  <Text size="sm">Rett filen og last den opp på nytt.</Text>
                </Stack>
              </Alert>
            )}
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setRows(null)}>
                Avbryt
              </Button>
              <Button
                disabled={blockers.length > 0}
                loading={uploadMutation.isPending}
                onClick={() => uploadMutation.mutate(rows)}
              >
                Bekreft opplasting
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </>
  );
}
