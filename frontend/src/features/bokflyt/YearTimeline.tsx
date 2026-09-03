import { Container, Stack, Text } from "@mantine/core";

import classes from "@/features/bokflyt/bokflyt.module.css";
import SectionHeading from "@/features/bokflyt/SectionHeading";

const STOPS: { month: string; text: string; highlight?: boolean }[] = [
  {
    month: "Vår",
    text: "Fagvalgene og boklistene for neste skoleår sendes til oss. Elever og foresatte signerer låneavtalen på mobilen.",
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
    text: "Elevene som gikk VG1 har hatt bøkene hjemme i ferien, og gir dem til de nye VG1-elevene. Standen trengs bare når et fag får flere eller færre elever, eller når skolen bytter tittel.",
    highlight: true,
  },
];

export default function YearTimeline() {
  return (
    <section className={`${classes.section} ${classes.wash}`}>
      <Container size="lg">
        <SectionHeading
          title="Skoleåret med Bokflyt"
          lead="Det meste skjer i juni, før elevene drar på ferie. Resten tar vi i august."
        />
        <ol className={classes.timeline}>
          {STOPS.map((stop) => (
            <li
              key={stop.month}
              className={`${classes.timelineStop} ${stop.highlight ? classes.timelineStopHighlight : ""}`}
            >
              <Stack gap={6}>
                <span className={classes.month}>{stop.month}</span>
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
