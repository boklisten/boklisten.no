import { ActionIcon, Button, Card, Group, Menu, Switch, TextInput, Tooltip } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { modals } from "@mantine/modals";
import { IconDotsVertical, IconPencil, IconTrash } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import DeleteRoundModal from "@/features/matches/rounds/DeleteRoundModal";
import GenerateRoundButton from "@/features/matches/rounds/GenerateRoundButton";
import NotifyRoundButton from "@/features/matches/rounds/NotifyRoundButton";
import RoundSelector from "@/features/matches/rounds/RoundSelector";
import type { Round } from "@/features/matches/rounds/useRounds";
import useApiClient from "@/shared/hooks/useApiClient";
import useAuth from "@/shared/hooks/useAuth";
import { showErrorNotification, showSuccessNotification } from "@/shared/utils/notifications";

function RenameForm({ round, onRename }: { round: Round; onRename: (name: string) => void }) {
  const [name, setName] = useState(round.name);
  return (
    <Group align={"flex-end"}>
      <TextInput
        style={{ flex: 1 }}
        label={"Navn på runden"}
        value={name}
        onChange={(event) => setName(event.currentTarget.value)}
      />
      <Button
        disabled={name.trim().length === 0}
        onClick={() => {
          onRename(name.trim());
          modals.closeAll();
        }}
      >
        Lagre
      </Button>
    </Group>
  );
}

export default function RoundToolbar({
  rounds,
  selectedRoundId,
  onSelect,
}: {
  rounds: Round[];
  selectedRoundId: string | null;
  onSelect: (roundId: string | null) => void;
}) {
  const { client, api } = useApiClient();
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [deleteOpened, deleteModal] = useDisclosure(false);

  const selected = rounds.find((round) => round.id === selectedRoundId);
  const active = selected?.status === "active";

  const patchMutation = useMutation({
    mutationFn: async (patch: { id: string; name?: string; status?: "draft" | "active" }) =>
      client.api.matchRounds.update({
        params: { id: patch.id },
        body: {
          ...(patch.name !== undefined && { name: patch.name }),
          ...(patch.status !== undefined && { status: patch.status }),
        },
      }),
    onSuccess: () => {
      showSuccessNotification("Runden ble oppdatert");
      void queryClient.invalidateQueries({ queryKey: api.matchRounds.index.queryKey() });
    },
    onError: () => showErrorNotification("Klarte ikke oppdatere runden"),
  });

  return (
    <Card withBorder radius={"md"} padding={"sm"}>
      <Group justify={"space-between"} gap={"sm"} wrap={"wrap"}>
        <Group gap={"md"} wrap={"wrap"}>
          <RoundSelector rounds={rounds} selectedRoundId={selectedRoundId} onSelect={onSelect} />
          {isAdmin && selected && (
            <Tooltip
              label={
                active
                  ? "Elevene ser runden, og bøkene i den er låst til overleveringer"
                  : "Utkast – skjult for elevene, låser ingen bøker"
              }
              refProp={"rootRef"}
            >
              <Switch
                label={"Synlig for elever"}
                checked={active}
                disabled={patchMutation.isPending}
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
        <Group gap={"xs"} wrap={"wrap"}>
          <NotifyRoundButton roundId={selectedRoundId} disabled={!active} />
          <GenerateRoundButton onGenerated={onSelect} />
          {isAdmin && selected && (
            <>
              <Menu position={"bottom-end"} withArrow>
                <Menu.Target>
                  <ActionIcon variant={"default"} size={36} aria-label={"Flere valg for runden"}>
                    <IconDotsVertical size={18} />
                  </ActionIcon>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Item
                    leftSection={<IconPencil size={16} />}
                    onClick={() =>
                      modals.open({
                        title: "Gi runden nytt navn",
                        children: (
                          <RenameForm
                            round={selected}
                            onRename={(name) => patchMutation.mutate({ id: selected.id, name })}
                          />
                        ),
                      })
                    }
                  >
                    Gi nytt navn
                  </Menu.Item>
                  <Menu.Divider />
                  <Menu.Item
                    color={"red"}
                    leftSection={<IconTrash size={16} />}
                    onClick={deleteModal.open}
                  >
                    Slett runden
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
              <DeleteRoundModal
                round={selected}
                opened={deleteOpened}
                onClose={deleteModal.close}
                onDeleted={() => onSelect(null)}
              />
            </>
          )}
        </Group>
      </Group>
    </Card>
  );
}
