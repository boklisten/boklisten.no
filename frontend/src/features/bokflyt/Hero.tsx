import { Button, Container, Group, Stack, Text, Title } from "@mantine/core";

import classes from "@/features/bokflyt/bokflyt.module.css";
import BookFlowDiagram from "@/features/bokflyt/BookFlowDiagram";
import { scrollToSection } from "@/features/bokflyt/scrollToSection";
import { BOKFLYT_COLORS } from "@/features/bokflyt/theme";

export default function Hero() {
  return (
    <section className={classes.hero} id="topp">
      <Container size="lg">
        <div className={classes.heroGrid}>
          <Stack gap="lg">
            <Title order={1} className={`${classes.display} ${classes.heroTitle}`}>
              Lærebøkene går rett fra elev til elev.
            </Title>
            <Text className={classes.lead}>
              Bokflyt setter opp direkte overleveringer av lærebøker ut fra elevenes fagvalg. Skolen
              slipper utlevering, lagring og etterarbeid, og elevene har neste års bøker før
              sommerferien.
            </Text>
            <Group gap="sm">
              <Button
                component="a"
                href="#kontakt"
                onClick={(event) => scrollToSection(event, "kontakt")}
                size="lg"
                radius="xl"
                color={BOKFLYT_COLORS.deep}
              >
                Book en uforpliktende prat
              </Button>
              <Button
                component="a"
                href="#slik-kommer-dere-i-gang"
                onClick={(event) => scrollToSection(event, "slik-kommer-dere-i-gang")}
                size="lg"
                radius="xl"
                variant="light"
                color={BOKFLYT_COLORS.deep}
              >
                Se hvordan det fungerer
              </Button>
            </Group>
            <Text size="sm" c="dimmed">
              Boklisten har levert skolebøker siden 1990. Bokflyt er utviklet sammen med Ullern
              videregående skole, der ordningen er i full drift.
            </Text>
          </Stack>

          <Stack gap="xs">
            <BookFlowDiagram />
            <Text size="sm" c="dimmed" ta="center">
              Bøkene går rett til eleven som trenger dem neste år. Standen dekker bare endringen i
              antall bøker fra et år til det neste.
            </Text>
          </Stack>
        </div>
      </Container>
    </section>
  );
}
