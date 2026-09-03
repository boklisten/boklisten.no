import { Container, SimpleGrid, Stack, Text, Title } from "@mantine/core";

import classes from "@/features/bokflyt/bokflyt.module.css";
import SectionHeading from "@/features/bokflyt/SectionHeading";

const POINTS: { title: string; text: string }[] = [
  {
    title: "Under terskelverdien",
    text: "Tjenesten prises som en andel av bokprisen og ligger under den nasjonale terskelverdien. Den kan derfor normalt kjøpes inn direkte, uten full anbudsrunde.",
  },
  {
    title: "Ett overføringsmøte",
    text: "Innføringen gjøres i et to timers møte hos dere, mellom oss og skolens bibliotekar. Vår utvikler hjelper med eksporten fra biblioteksystemet.",
  },
  {
    title: "Tett oppfølging",
    text: "Vi tar inn én til to nye skoler per skoleår, slik at hver skole får tett oppfølging det første året.",
  },
];

export default function Pricing() {
  return (
    <section className={classes.section}>
      <Container size="lg">
        <SectionHeading
          title="Pris og innkjøp"
          lead="Vi gir et konkret tilbud i den første samtalen. Dette vet dere allerede nå:"
        />
        <SimpleGrid cols={{ base: 1, md: 3 }} spacing={{ base: "xl", md: 40 }}>
          {POINTS.map((point) => (
            <Stack key={point.title} gap="xs">
              <Title order={3} size="h4">
                {point.title}
              </Title>
              <Text c="dimmed">{point.text}</Text>
            </Stack>
          ))}
        </SimpleGrid>
      </Container>
    </section>
  );
}
