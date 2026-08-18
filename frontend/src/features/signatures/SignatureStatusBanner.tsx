import type { UserDetail } from "@boklisten/backend/shared/user-detail";
import { Group, Paper, Stack, Text, UnstyledButton } from "@mantine/core";
import { modals } from "@mantine/modals";
import {
  IconAlertTriangleFilled,
  IconChevronRight,
  IconCircleCheckFilled,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";

import AdministrateUserSignatures from "@/features/signatures/AdministrateUserSignatures";
import ErrorAlert from "@/shared/components/alerts/ErrorAlert";
import useApiClient from "@/shared/hooks/useApiClient";
import { PLEASE_TRY_AGAIN_TEXT } from "@/shared/utils/constants";

const POLL_INTERVAL_MS = 5000;

export default function SignatureStatusBanner({ userDetail }: { userDetail: UserDetail }) {
  const { api } = useApiClient();
  const { data, isPending, isError } = useQuery(
    api.signatures.getSignature.queryOptions(
      { params: { detailsId: userDetail.id } },
      { refetchInterval: POLL_INTERVAL_MS },
    ),
  );

  if (isPending) {
    return null;
  }
  if (!data || isError) {
    return (
      <ErrorAlert title={"Klarte ikke laste signaturstatus"}>{PLEASE_TRY_AGAIN_TEXT}</ErrorAlert>
    );
  }

  const openSignatureModal = () =>
    modals.open({
      title: "Signatur",
      children: <AdministrateUserSignatures userDetail={userDetail} />,
    });

  if (data.isSignatureValid) {
    return (
      <UnstyledButton
        onClick={openSignatureModal}
        aria-label={"Gyldig signatur – se signatur"}
        w={"100%"}
      >
        <Paper
          withBorder
          radius={"md"}
          px={"md"}
          py={"xs"}
          bg={"green.0"}
          style={{ borderColor: "var(--mantine-color-green-3)" }}
        >
          <Group justify={"space-between"} wrap={"nowrap"}>
            <Group gap={"sm"} wrap={"nowrap"}>
              <IconCircleCheckFilled color={"var(--mantine-color-green-8)"} />
              <Stack gap={0}>
                <Text fw={600} c={"green.9"} size={"sm"}>
                  Gyldig signatur
                </Text>
                <Text size={"xs"} c={"dimmed"}>
                  Signert av {data.signingName}
                  {data.signedByGuardian ? " (foresatt)" : ""} · gyldig til {data.expiresAtText}
                </Text>
              </Stack>
            </Group>
            <Group gap={4} wrap={"nowrap"}>
              <Text size={"sm"} c={"green.9"}>
                Se signatur
              </Text>
              <IconChevronRight size={16} color={"var(--mantine-color-green-9)"} />
            </Group>
          </Group>
        </Paper>
      </UnstyledButton>
    );
  }

  if (!data.signatureRequired) {
    return null;
  }

  return (
    <UnstyledButton
      onClick={openSignatureModal}
      aria-label={"Mangler gyldig signatur – ordne signatur"}
      w={"100%"}
    >
      <Paper radius={"md"} px={"md"} py={"xs"} bg={"red.7"}>
        <Group justify={"space-between"} wrap={"nowrap"}>
          <Group gap={"sm"} wrap={"nowrap"}>
            <IconAlertTriangleFilled color={"white"} />
            <Stack gap={0}>
              <Text fw={700} c={"white"} size={"sm"}>
                Mangler gyldig signatur
              </Text>
              <Text size={"xs"} c={"red.0"}>
                Bøker kan ikke deles ut før kontrakten er signert.
              </Text>
            </Stack>
          </Group>
          <Group gap={4} wrap={"nowrap"}>
            <Text size={"sm"} fw={600} c={"white"}>
              Ordne signatur
            </Text>
            <IconChevronRight size={16} color={"white"} />
          </Group>
        </Group>
      </Paper>
    </UnstyledButton>
  );
}
