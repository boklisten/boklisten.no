import { Container, Stack, Text } from "@mantine/core";

import classes from "@/features/bokflyt/bokflyt.module.css";
import SectionHeading from "@/features/bokflyt/SectionHeading";

const STOPS: { month: string; text: string; highlight?: boolean }[] = [
  {
    month: "Vår",
    text: "Fagvalgene og boklistene for neste skoleår sendes til oss.",
  },
  {
    month: "Juni",
    text: "Bøker til VG2 og VG3 overleveres direkte fra elev til elev, ut fra fagvalg. VG1-elevene beholder bøkene sine til august.",
    highlight: true,
  },
  {
    month: "Sommer",
    text: "Ingen bøker på lager. Elevene har allerede neste års pensum hjemme.",
  },
  {
    month: "August",
    text: "Nye elever signerer låneavtalen. Bøker til VG1 overleveres direkte fra elev til elev, basert på fagvalg.",
    highlight: true,
  },
];

export default function YearTimeline() {
  return (
    <section className={classes.section}>
      <Container size="lg">
        <SectionHeading
          title="Skoleåret med Bokflyt"
          lead="Det meste skjer i juni, før elevene drar på ferie. Resten i august."
        />
        <ol className={classes.timeline}>
          {STOPS.map((stop) => (
            <li
              key={stop.month}
              className={`${classes.timelineStop} ${stop.highlight ? classes.timelineStopHighlight : ""}`}
            >
              <span className={classes.timelineNode} aria-hidden />
              <Stack gap={6}>
                <div className={classes.timelineHead}>
                  <span className={classes.month}>{stop.month}</span>
                  {stop.highlight && <span className={classes.timelineTag}>Overlevering</span>}
                </div>
                <Text c="dimmed">{stop.text}</Text>
              </Stack>
            </li>
          ))}
        </ol>
        <Text mt={40} maw={720}>
          Vil dere begynne midt i et skoleår? Da deler vi ut bøkene når det passer dere, og går over
          til den vanlige rytmen ved neste skoleår.
        </Text>
      </Container>
    </section>
  );
}
