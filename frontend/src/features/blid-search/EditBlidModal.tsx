import type { BlidSearchResult } from "@boklisten/backend/shared/blid_search";
import { Button, Collapse, Divider, Group, Modal, Select, Stack, Text } from "@mantine/core";
import { IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import MonitoringNotice from "@/shared/components/MonitoringNotice";
import useApiClient from "@/shared/hooks/useApiClient";
import { errorMessage } from "@/shared/utils/errorMessage";
import { itemSelectFilter, toItemSelectData } from "@/shared/utils/itemSelectFilter";
import { showErrorNotification, showSuccessNotification } from "@/shared/utils/notifications";

const HELD_REASON = "Boka er utdelt til en kunde og kan ikke slettes før den er levert tilbake.";

/**
 * Corrections to which book a blid is: move the sticker to another title, or delete it. Both
 * are monitored, so each section says so before its button. The delete confirms inline rather
 * than with a stacked confirm modal, which would unmount this one.
 */
export default function EditBlidModal({
  result,
  onClose,
  onDeleted,
}: {
  result: BlidSearchResult;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const { api } = useApiClient();
  const queryClient = useQueryClient();
  const { data: items } = useQuery(api.items.get.queryOptions());
  const currentItemId = result.book?.id ?? null;
  const [itemId, setItemId] = useState(currentItemId);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const held = result.status === "handed-out";

  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: api.blidSearch.lookup.pathKey() }),
      queryClient.invalidateQueries({ queryKey: api.blidSearch.search.pathKey() }),
      queryClient.invalidateQueries({ queryKey: api.branchBooks.getActiveBooks.pathKey() }),
      queryClient.invalidateQueries({ queryKey: api.branchBooks.getActiveBookDetails.pathKey() }),
    ]);

  const relinkMutation = useMutation(
    api.blidSearch.relink.mutationOptions({
      onSuccess: () => {
        showSuccessNotification("Boka ble endret");
        onClose();
      },
      onError: (error) => showErrorNotification(errorMessage(error, "Klarte ikke endre bok")),
      onSettled: invalidate,
    }),
  );
  const deleteMutation = useMutation(
    api.blidSearch.remove.mutationOptions({
      onSuccess: () => {
        showSuccessNotification("Unik ID-en ble slettet");
        onDeleted();
      },
      onError: (error) =>
        showErrorNotification(errorMessage(error, "Klarte ikke slette unik ID-en")),
      onSettled: invalidate,
    }),
  );
  const busy = relinkMutation.isPending || deleteMutation.isPending;

  return (
    <Modal opened onClose={onClose} title="Rediger bok">
      <Stack>
        <Text size="sm" c="dimmed">
          Unik ID {result.blid} er koblet til «{result.book?.title ?? "Ukjent tittel"}».
        </Text>
        <Select
          label="Endre bok"
          description="Historikken til den unike ID-en oppdateres med den nye boka"
          placeholder="Søk etter tittel eller ISBN"
          searchable
          nothingFoundMessage="Fant ingen bok"
          data={toItemSelectData(items)}
          filter={itemSelectFilter(items)}
          // Wait for the item list so the current title can be shown as the selection.
          value={items ? itemId : null}
          onChange={setItemId}
          allowDeselect={false}
        />
        <MonitoringNotice />
        <Group>
          <Button
            loading={relinkMutation.isPending}
            disabled={itemId === null || itemId === currentItemId || deleteMutation.isPending}
            onClick={() => {
              if (itemId === null) {
                return;
              }
              relinkMutation.mutate({ params: { blid: result.blid }, body: { itemId } });
            }}
          >
            Endre bok
          </Button>
        </Group>

        <Divider />

        <Stack gap="xs">
          <Text fw={700} c="red">
            Slett unik ID
          </Text>
          <Text size="sm">
            {held
              ? HELD_REASON
              : "Sletter koblingen mellom den unike ID-en og boka. Kundenes historikk beholdes."}
          </Text>
          {!held && <MonitoringNotice />}
          {!confirmingDelete && (
            <Group>
              <Button
                color="red"
                variant="outline"
                leftSection={<IconTrash size={16} aria-hidden />}
                // The sentence above already says why, so no tooltip is needed.
                disabled={held}
                onClick={() => setConfirmingDelete(true)}
              >
                Slett unik ID
              </Button>
            </Group>
          )}
          <Collapse expanded={confirmingDelete}>
            <Group>
              <Button variant="default" disabled={busy} onClick={() => setConfirmingDelete(false)}>
                Avbryt
              </Button>
              <Button
                color="red"
                leftSection={<IconTrash size={16} aria-hidden />}
                loading={deleteMutation.isPending}
                disabled={relinkMutation.isPending}
                onClick={() => deleteMutation.mutate({ params: { blid: result.blid } })}
              >
                Slett unik ID permanent
              </Button>
            </Group>
          </Collapse>
        </Stack>
      </Stack>
    </Modal>
  );
}
