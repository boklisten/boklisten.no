import { Badge, Group, Stack, Text } from "@mantine/core";
import { IconFileSpreadsheet, IconUsers } from "@tabler/icons-react";

import classes from "@/features/bokflyt/bokflyt.module.css";
import Reveal from "@/features/bokflyt/Reveal";
import { BOKFLYT_COLORS } from "@/features/bokflyt/theme";

const ROWS: [string, string, string][] = [
  ["Jonas Lie", "3STA", "6 bøker"],
  ["Nora Hansen", "2STA", "6 bøker"],
  ["Emil Berg", "1STB", "7 bøker"],
  ["Mia Solberg", "2STC", "5 bøker"],
];

/** An exported student list on its way into Bokflyt. */
export default function ExportFigure() {
  return (
    <Reveal>
      <div
        className={classes.paperMock}
        role="img"
        aria-label="En eksportert elevliste med navn, klasse og antall bøker"
      >
        <Stack gap="sm">
          <Group gap="xs">
            <IconFileSpreadsheet size={20} color={BOKFLYT_COLORS.deep} />
            <Text fw={600}>elever-og-boker.csv</Text>
          </Group>
          <div>
            <div className={`${classes.csvRow} ${classes.csvHead}`}>
              <span>Navn</span>
              <span>Klasse</span>
              <span>Har</span>
            </div>
            {ROWS.map(([name, group, books], index) => (
              <Reveal key={name} delay={0.25 + index * 0.15}>
                <div className={classes.csvRow}>
                  <span>{name}</span>
                  <span>{group}</span>
                  <span>{books}</span>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={1}>
            <Group justify="flex-end">
              <Badge
                color={BOKFLYT_COLORS.deep}
                variant="light"
                size="lg"
                leftSection={<IconUsers size={14} />}
              >
                412 elever importert
              </Badge>
            </Group>
          </Reveal>
        </Stack>
      </div>
    </Reveal>
  );
}
