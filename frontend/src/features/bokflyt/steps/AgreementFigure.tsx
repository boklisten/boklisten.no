import { Badge, Group, Stack, Text } from "@mantine/core";
import { IconCircleCheckFilled } from "@tabler/icons-react";

import classes from "@/features/bokflyt/bokflyt.module.css";
import Reveal from "@/features/bokflyt/Reveal";
import { BOKFLYT_COLORS } from "@/features/bokflyt/theme";

/** A signed data processing agreement, drawn as a sheet of paper. */
export default function AgreementFigure() {
  return (
    <Reveal>
      <div className={classes.paperMock} role="img" aria-label="En signert databehandleravtale">
        <Stack gap="md">
          <Group justify="space-between" align="flex-start">
            <Stack gap={2}>
              <Text fw={700} c={BOKFLYT_COLORS.deep}>
                Databehandleravtale
              </Text>
              <Text size="xs" c="dimmed">
                mellom skolen og Boklisten.no AS
              </Text>
            </Stack>
            <Reveal delay={0.7}>
              <Badge
                color="teal"
                variant="light"
                size="lg"
                leftSection={<IconCircleCheckFilled size={14} />}
              >
                Signert
              </Badge>
            </Reveal>
          </Group>
          <Stack gap={8}>
            <div className={classes.paperLine} style={{ width: "92%" }} />
            <div className={classes.paperLine} style={{ width: "100%" }} />
            <div className={classes.paperLine} style={{ width: "84%" }} />
            <div className={classes.paperLine} style={{ width: "96%" }} />
            <div className={classes.paperLine} style={{ width: "58%" }} />
          </Stack>
          <Stack gap={8} mt="sm">
            <div className={classes.paperLine} style={{ width: "88%" }} />
            <div className={classes.paperLine} style={{ width: "70%" }} />
          </Stack>
          <Group justify="space-between" mt="md" gap="xl">
            <Stack gap={4} style={{ flex: 1 }}>
              <div className={classes.signatureLine} />
              <Text size="xs" c="dimmed">
                For skolen
              </Text>
            </Stack>
            <Stack gap={4} style={{ flex: 1 }}>
              <div className={classes.signatureLine} />
              <Text size="xs" c="dimmed">
                For Boklisten.no
              </Text>
            </Stack>
          </Group>
        </Stack>
      </div>
    </Reveal>
  );
}
