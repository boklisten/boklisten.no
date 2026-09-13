import { Group, Paper, Stack, Text, UnstyledButton } from "@mantine/core";
import {
  IconAlertTriangleFilled,
  IconChevronRight,
  IconCircleCheckFilled,
} from "@tabler/icons-react";
import type { ReactNode } from "react";

export type SignatureStatusTone = "valid" | "warning" | "missing";

/** The colours of each state: a calm green card, an orange one, and a solid red one that shouts. */
const TONES: Record<
  SignatureStatusTone,
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
