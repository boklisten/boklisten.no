import { Group, Paper, Stack, Text, UnstyledButton } from "@mantine/core";
import {
  IconAlertTriangleFilled,
  IconChevronRight,
  IconCircleCheckFilled,
} from "@tabler/icons-react";
import type { ReactNode } from "react";

import classes from "@/features/signatures/SignatureStatusCard.module.css";

export type SignatureStatusTone = "valid" | "warning" | "missing";

/** The glyph and weight of each state; the colours live in the stylesheet, per scheme. */
const TONES: Record<
  SignatureStatusTone,
  { icon: typeof IconCircleCheckFilled; withBorder: boolean; titleWeight: number }
> = {
  valid: { icon: IconCircleCheckFilled, withBorder: true, titleWeight: 600 },
  warning: { icon: IconAlertTriangleFilled, withBorder: true, titleWeight: 600 },
  missing: { icon: IconAlertTriangleFilled, withBorder: false, titleWeight: 700 },
};

/**
 * One compact signature status card: the glyph and the words in the tone's colours, with a chevron
 * for the way in. Shared by the employee banner and the customer's own status card.
 */
export default function SignatureStatusCard({
  tone,
  title,
  description,
  ariaLabel,
  expanded,
  onClick,
}: {
  tone: SignatureStatusTone;
  title: string;
  description: ReactNode;
  ariaLabel: string;
  /** Set when the details open under the card, so the chevron turns to point at them. */
  expanded?: boolean;
  onClick: () => void;
}) {
  const { icon: Icon, withBorder, titleWeight } = TONES[tone];
  return (
    <UnstyledButton onClick={onClick} aria-label={ariaLabel} aria-expanded={expanded} w="100%">
      <Paper
        radius="md"
        px="md"
        py="xs"
        withBorder={withBorder}
        className={classes.card}
        data-tone={tone}
      >
        <Group justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap" miw={0}>
            <Icon className={classes.icon} />
            <Stack gap={0}>
              <Text fw={titleWeight} size="sm" className={classes.title}>
                {title}
              </Text>
              <Text size="xs" className={classes.description}>
                {description}
              </Text>
            </Stack>
          </Group>
          <IconChevronRight
            size={20}
            className={classes.chevron}
            data-expanded={expanded ? "true" : undefined}
            aria-hidden
          />
        </Group>
      </Paper>
    </UnstyledButton>
  );
}
