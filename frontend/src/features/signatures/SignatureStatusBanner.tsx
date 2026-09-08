import type { UserDetail } from "@boklisten/backend/shared/user-detail";
import { Collapse, Group, Paper, Stack, Text, UnstyledButton } from "@mantine/core";
import { modals } from "@mantine/modals";
import {
  IconAlertTriangleFilled,
  IconChevronRight,
  IconCircleCheckFilled,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useState } from "react";

import AdministrateUserSignatures from "@/features/signatures/AdministrateUserSignatures";
import ErrorAlert from "@/shared/components/alerts/ErrorAlert";
import useApiClient from "@/shared/hooks/useApiClient";
import { PLEASE_TRY_AGAIN_TEXT } from "@/shared/utils/constants";

const POLL_INTERVAL_MS = 5000;

type Tone = "valid" | "warning" | "missing";

/** The colours of each state: a calm green card, an orange one, and a solid red one that shouts. */
const TONES: Record<
  Tone,
  {
    icon: typeof IconCircleCheckFilled;
    iconColor: string;
    title: string;
    titleWeight: number;
    description: string;
    chevron: string;
    paper: { withBorder: boolean; bg: string; borderColor?: string };
  }
> = {
  valid: {
    icon: IconCircleCheckFilled,
    iconColor: "var(--mantine-color-green-8)",
    title: "green.9",
    titleWeight: 600,
    description: "dimmed",
    chevron: "var(--mantine-color-green-9)",
    paper: { withBorder: true, bg: "green.0", borderColor: "var(--mantine-color-green-3)" },
  },
  warning: {
    icon: IconAlertTriangleFilled,
    iconColor: "var(--mantine-color-orange-8)",
    title: "orange.9",
    titleWeight: 600,
    description: "dimmed",
    chevron: "var(--mantine-color-orange-9)",
    paper: { withBorder: true, bg: "orange.0", borderColor: "var(--mantine-color-orange-3)" },
  },
  missing: {
    icon: IconAlertTriangleFilled,
    iconColor: "white",
    title: "white",
    titleWeight: 700,
    description: "red.0",
    chevron: "white",
    paper: { withBorder: false, bg: "red.7" },
  },
};

/** One status card: the glyph and the words in the tone's colours, with a chevron for the way in. */
function StatusCard({
  tone,
  title,
  description,
  ariaLabel,
  expanded,
  onClick,
}: {
  tone: Tone;
  title: string;
  description: ReactNode;
  ariaLabel: string;
  /** Set when the details open under the card, so the chevron turns to point at them. */
  expanded?: boolean;
  onClick: () => void;
}) {
  const colors = TONES[tone];
  const Icon = colors.icon;
  return (
    <UnstyledButton onClick={onClick} aria-label={ariaLabel} aria-expanded={expanded} w="100%">
      <Paper
        radius="md"
        px="md"
        py="xs"
        withBorder={colors.paper.withBorder}
        bg={colors.paper.bg}
        style={{ borderColor: colors.paper.borderColor }}
      >
        <Group justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap" miw={0}>
            <Icon color={colors.iconColor} />
            <Stack gap={0}>
              <Text fw={colors.titleWeight} c={colors.title} size="sm">
                {title}
              </Text>
              <Text size="xs" c={colors.description}>
                {description}
              </Text>
            </Stack>
          </Group>
          <IconChevronRight
            size={20}
            color={colors.chevron}
            style={{
              flexShrink: 0,
              transition: "transform 150ms ease",
              transform: expanded ? "rotate(90deg)" : undefined,
            }}
            aria-hidden
          />
        </Group>
      </Paper>
    </UnstyledButton>
  );
}

/**
 * Whether the customer's contract is signed, as a card that leads to the signature itself. On
 * the Kasse card the details open in a modal, and a valid signature is left out on a phone since
 * it asks nothing of the employee. In the customer's settings (`inForm`) the card always shows and
 * the details unfold under it: a second modal would unmount the form and drop unsaved edits.
 */
export default function SignatureStatusBanner({
  userDetail,
  inForm = false,
}: {
  userDetail: UserDetail;
  inForm?: boolean;
}) {
  const { api } = useApiClient();
  const [expanded, setExpanded] = useState(false);
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
      <ErrorAlert title="Klarte ikke laste signaturstatus">{PLEASE_TRY_AGAIN_TEXT}</ErrorAlert>
    );
  }

  const openDetails = () => {
    if (inForm) {
      setExpanded((open) => !open);
      return;
    }
    modals.open({
      title: "Signatur",
      children: <AdministrateUserSignatures userDetail={userDetail} />,
    });
  };

  const card = (tone: Tone, title: string, description: ReactNode, ariaLabel: string) => (
    <StatusCard
      tone={tone}
      title={title}
      description={description}
      ariaLabel={ariaLabel}
      expanded={inForm ? expanded : undefined}
      onClick={openDetails}
    />
  );

  const withDetails = (content: ReactNode, hideOnPhone = false) => (
    <Stack gap="xs" visibleFrom={hideOnPhone ? "sm" : undefined}>
      {content}
      {inForm && (
        <Collapse expanded={expanded}>
          <AdministrateUserSignatures userDetail={userDetail} />
        </Collapse>
      )}
    </Stack>
  );

  if (data.isSignatureValid) {
    return withDetails(
      card(
        "valid",
        "Gyldig signatur",
        <>
          {/* Non-breaking spaces keep the dot with the first half and the date with
              "gyldig til", so a narrow card wraps into two tidy lines. */}
          Signert av {data.signedByGuardian ? "foresatt" : "kunden selv"}
          {"\u00A0· gyldig\u00A0til\u00A0"}
          {data.expiresAtText}
        </>,
        "Gyldig signatur – se signatur",
      ),
      !inForm,
    );
  }

  if (!data.signatureRequired) {
    return null;
  }

  if (data.outgrownGuardianSignature) {
    return withDetails(
      card(
        "warning",
        "Signert av foresatt, må signeres på nytt",
        "Kunden har fylt 18 år og må signere selv før bøker kan deles ut. Trykk her for å ordne signaturen.",
        "Signert av foresatt, må signeres på nytt – ordne signatur",
      ),
    );
  }

  return withDetails(
    card(
      "missing",
      "Mangler gyldig signatur",
      "Bøker kan ikke deles ut før kontrakten er signert. Trykk her for å ordne signaturen.",
      "Mangler gyldig signatur – ordne signatur",
    ),
  );
}
