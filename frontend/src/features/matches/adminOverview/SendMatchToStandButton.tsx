import type { MatchDto } from "@boklisten/backend/shared/match/match-dto";
import { Button, Group, Modal, Stack, Text } from "@mantine/core";
import { IconBuildingStore } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { isMatchFinished } from "@/features/matches/adminOverview/adminMatchHelper";
import useApiClient from "@/shared/hooks/useApiClient";
import useAuth from "@/shared/hooks/useAuth";
import { showErrorNotification, showSuccessNotification } from "@/shared/utils/notifications";

export default function SendMatchToStandButton({
  match,
  onSent,
}: {
  match: MatchDto;
  onSent?: () => void;
}) {
  const { isAdmin } = useAuth();
  const { api } = useApiClient();
  const queryClient = useQueryClient();
  const [opened, setOpened] = useState(false);

  const sendToStandMutation = useMutation(
    api.matches.sendToStand.mutationOptions({
      onSuccess: () => {
        showSuccessNotification("Overleveringen ble sendt til stand");
        void queryClient.invalidateQueries({
          queryKey: api.matches.getMatchesForRound.queryKey(),
        });
        void queryClient.invalidateQueries({
          queryKey: api.matches.getMatchesForCustomer.queryKey(),
        });
        setOpened(false);
        onSent?.();
      },
      onError: () => showErrorNotification("Klarte ikke sende overleveringen til stand"),
    }),
  );

  if (!isAdmin || match.isStandMatch || isMatchFinished(match)) return null;

  const names = match.participants.flatMap((party) =>
    party.kind === "customer" ? [party.name] : [],
  );

  return (
    <>
      <Group>
        <Button
          color={"orange"}
          leftSection={<IconBuildingStore size={18} aria-hidden />}
          onClick={() => setOpened(true)}
        >
          Send til stand
        </Button>
      </Group>
      <Modal opened={opened} onClose={() => setOpened(false)} title={"Send til stand"}>
        <Stack>
          <Text>
            Dette avlyser møtet mellom{" "}
            <Text span fw={600}>
              {names.join(" og ")}
            </Text>
            . Bøkene legges i stedet til standoverleveringene deres, så begge må innom standen.
          </Text>
          <Text size={"sm"} c={"dimmed"}>
            Bøker som allerede er overlevert beholdes i historikken. Elevene varsles ikke.
          </Text>
          <Group justify={"flex-end"}>
            <Button variant={"default"} onClick={() => setOpened(false)}>
              Avbryt
            </Button>
            <Button
              color={"orange"}
              leftSection={<IconBuildingStore size={16} aria-hidden />}
              loading={sendToStandMutation.isPending}
              onClick={() => sendToStandMutation.mutate({ params: { matchId: match.id } })}
            >
              Send til stand
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
