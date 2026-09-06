import type {
  EmailValidationChecks,
  EmailValidationResult,
  EmailValidationSource,
} from "@boklisten/backend/shared/email_validation";
import { Alert, Button, Group, List, Stack, Text } from "@mantine/core";
import { IconMailExclamation, IconMailQuestion } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import validator from "validator";

import { publicApiClient } from "@/shared/utils/publicApiClient";

export type EmailDeliverabilityPerspective = "personal" | "administrate";

const REASONS: { check: keyof EmailValidationChecks; flagged: boolean; text: string }[] = [
  { check: "hasValidAddressSyntax", flagged: false, text: "Adressen er ikke skrevet riktig." },
  { check: "hasMxOrARecord", flagged: false, text: "Det som står etter @ tar ikke imot e-post." },
  {
    check: "isSuspectedDisposableAddress",
    flagged: true,
    text: "Dette ser ut som en midlertidig engangsadresse.",
  },
  {
    check: "isSuspectedRoleAddress",
    flagged: true,
    text: "Dette ser ut som en felles adresse (som post@ eller info@), ikke en personlig.",
  },
  {
    check: "hasKnownBounces",
    flagged: true,
    text: "E-post til adressen har kommet i retur tidligere.",
  },
  {
    check: "hasSuspectedBounces",
    flagged: true,
    text: "E-post til adressen har trolig kommet i retur tidligere.",
  },
];

function reasonsFor(checks: EmailValidationChecks) {
  return REASONS.filter(({ check, flagged }) => checks[check] === flagged).map(({ text }) => text);
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function emailDeliverabilityQueryOptions(email: string, source: EmailValidationSource) {
  return {
    queryKey: ["email-deliverability", source, email] as const,
    queryFn: (): Promise<EmailValidationResult> =>
      publicApiClient.api.emailValidation.validate({ body: { email, source } }),
    enabled: validator.isEmail(email),
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  };
}

/**
 * Advisory note under an email field once the user has left it: SendGrid's opinion on whether
 * mail will actually arrive, with the concrete reasons and a one-click fix for domain typos.
 * Shown for "Invalid" and "Risky" verdicts; renders nothing for "Valid", while loading, or when
 * the check is unavailable, and never touches the field's validation state.
 */
export default function EmailDeliverabilityHint({
  email,
  source,
  perspective,
  onApplySuggestion,
}: {
  /** The normalized address as it was when the field was last left. */
  email: string;
  source: EmailValidationSource;
  perspective: EmailDeliverabilityPerspective;
  onApplySuggestion: (email: string) => void;
}) {
  const { data } = useQuery(emailDeliverabilityQueryOptions(email, source));

  if (!data?.available || data.verdict === "Valid") {
    return null;
  }

  const invalid = data.verdict === "Invalid";
  const reasons = reasonsFor(data.checks);

  return (
    <Alert
      color={invalid ? "orange" : "yellow"}
      icon={invalid ? <IconMailExclamation /> : <IconMailQuestion />}
      title={
        invalid
          ? "E-post når trolig ikke fram til denne adressen"
          : "E-post når kanskje ikke fram til denne adressen"
      }
    >
      <Stack gap="xs">
        {reasons.length > 0 && (
          <List size="sm" spacing={2}>
            {reasons.map((reason) => (
              <List.Item key={reason}>{reason}</List.Item>
            ))}
          </List>
        )}
        {data.suggestion && (
          <Group gap="xs">
            <Text size="sm">
              Mente du <b>{data.suggestion}</b>?
            </Text>
            <Button
              size="compact-xs"
              variant="light"
              color={invalid ? "orange" : "yellow"}
              onClick={() => onApplySuggestion(data.suggestion ?? "")}
            >
              Bruk {data.suggestion}
            </Button>
          </Group>
        )}
        <Text size="sm">
          {perspective === "administrate"
            ? "Kunden kan fortsatt registreres med adressen, men sjekk at den er riktig."
            : "Du kan fortsatt bruke adressen, men sjekk at den er riktig."}
        </Text>
      </Stack>
    </Alert>
  );
}
