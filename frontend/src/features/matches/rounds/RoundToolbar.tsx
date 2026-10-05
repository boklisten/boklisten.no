import { ActionIcon, Button, Card, Group, Menu, Switch, Tooltip } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { modals } from "@mantine/modals";
import { IconDotsVertical, IconPencil, IconPlus, IconTrash } from "@tabler/icons-react";
import { useMutation } from "@tanstack/react-query";

import DeleteMatchesModal from "@/features/matches/rounds/DeleteMatchesModal";
import DeleteRoundModal from "@/features/matches/rounds/DeleteRoundModal";
import NotifyRoundButton from "@/features/matches/rounds/NotifyRoundButton";
import RoundSelector from "@/features/matches/rounds/RoundSelector";
import { isPlanned, useRefreshRounds } from "@/features/matches/rounds/useRounds";
import type { Round } from "@/features/matches/rounds/useRounds";
import { api, apiClient } from "@/shared/utils/apiClient";
import { useAppForm } from "@/shared/hooks/form";
import useAuth from "@/shared/hooks/useAuth";
import useAutoSave from "@/shared/hooks/useAutoSave";
import { showErrorNotification, showSuccessNotification } from "@/shared/utils/notifications";

/** The round's name, auto-saved on blur (see `useAutoSave`). */
function RenameForm({ round }: { round: Round }) {
  const form = useAppForm(
    useAutoSave({
      defaultValues: { name: round.name },
      persist: ({ name }) =>
        apiClient.api.matchRounds.update({ params: { id: round.id }, body: { name: name.trim() } }),
      invalidates: [api.matchRounds.index.pathKey()],
    }),
  );

  return (
    <form.AppField
      name="name"
      validators={{
        onChange: ({ value }) => (value.trim().length === 0 ? "Fyll inn et navn" : undefined),
      }}
    >
      {(field) => <field.TextField label="Navn på runden" data-autofocus />}
    </form.AppField>
  );
}

export default function RoundToolbar({
  rounds,
  selectedRoundId,
  onSelect,
  onNewRound,
  onEditPlan,
}: {
  rounds: Round[];
  selectedRoundId: string | null;
  onSelect: (roundId: string | null) => void;
  onNewRound: () => void;
  onEditPlan: () => void;
}) {
  const { isAdmin } = useAuth();
  const refreshRounds = useRefreshRounds();
  const [deleteOpened, deleteModal] = useDisclosure(false);
  const [deleteMatchesOpened, deleteMatchesModal] = useDisclosure(false);

  const selected = rounds.find((round) => round.id === selectedRoundId);
  const active = selected?.status === "active";
  const planned = selected !== undefined && isPlanned(selected);

  const patchMutation = useMutation({
    mutationFn: async (patch: { id: string; status: "draft" | "active" }) =>
      apiClient.api.matchRounds.update({
        params: { id: patch.id },
        body: { status: patch.status },
      }),
    onSuccess: () => {
      showSuccessNotification("Runden ble oppdatert");
      refreshRounds();
    },
    onError: () => showErrorNotification("Klarte ikke oppdatere runden"),
  });

  return (
    <Card withBorder radius="md" padding="sm">
      <Group justify="space-between" gap="sm" wrap="wrap">
        <Group gap="md" wrap="wrap">
          <RoundSelector rounds={rounds} selectedRoundId={selectedRoundId} onSelect={onSelect} />
          {isAdmin && selected && (
            <Tooltip
              label={
                planned
                  ? "Runden må genereres før elevene kan se den"
                  : active
                    ? "Elevene ser runden og overleveringene sine"
                    : "Utkast – skjult for elevene"
              }
              refProp="rootRef"
            >
              <Switch
                label="Synlig for elever"
                checked={active}
                disabled={patchMutation.isPending || planned}
                onChange={(event) =>
                  patchMutation.mutate({
                    id: selected.id,
                    status: event.currentTarget.checked ? "active" : "draft",
                  })
                }
              />
            </Tooltip>
          )}
        </Group>
        {isAdmin && (
          <Group gap="xs" wrap="wrap">
            <NotifyRoundButton roundId={selectedRoundId} disabled={!active} />
            <Button variant="default" leftSection={<IconPlus size={16} />} onClick={onNewRound}>
              Ny runde
            </Button>
            {selected && (
              <>
                <Menu position="bottom-end" withArrow>
                  <Menu.Target>
                    <ActionIcon variant="default" size={36} aria-label="Flere valg for runden">
                      <IconDotsVertical size={18} />
                    </ActionIcon>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Menu.Item
                      leftSection={<IconPencil size={16} />}
                      onClick={() =>
                        modals.open({
                          title: "Gi runden nytt navn",
                          children: <RenameForm round={selected} />,
                        })
                      }
                    >
                      Gi nytt navn
                    </Menu.Item>
                    {planned && (
                      <Menu.Item leftSection={<IconPencil size={16} />} onClick={onEditPlan}>
                        Rediger planen
                      </Menu.Item>
                    )}
                    <Menu.Divider />
                    {!planned && (
                      <Menu.Item
                        color="red"
                        leftSection={<IconTrash size={16} />}
                        onClick={deleteMatchesModal.open}
                      >
                        Slett overleveringene
                      </Menu.Item>
                    )}
                    <Menu.Item
                      color="red"
                      leftSection={<IconTrash size={16} />}
                      onClick={deleteModal.open}
                    >
                      Slett runden
                    </Menu.Item>
                  </Menu.Dropdown>
                </Menu>
                <DeleteMatchesModal
                  round={selected}
                  opened={deleteMatchesOpened}
                  onClose={deleteMatchesModal.close}
                />
                <DeleteRoundModal
                  round={selected}
                  opened={deleteOpened}
                  onClose={deleteModal.close}
                  onDeleted={() => onSelect(null)}
                />
              </>
            )}
          </Group>
        )}
      </Group>
    </Card>
  );
}
