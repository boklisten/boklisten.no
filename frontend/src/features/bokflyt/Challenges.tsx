import { Container, Group, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import {
  IconBookOff,
  IconBoxSeam,
  IconClockExclamation,
  IconFileInvoice,
} from "@tabler/icons-react";
import type { ReactNode } from "react";

import classes from "@/features/bokflyt/bokflyt.module.css";
import SectionHeading from "@/features/bokflyt/SectionHeading";

const CHALLENGES: { icon: ReactNode; title: string; text: string }[] = [
  {
    icon: <IconClockExclamation size={26} />,
    title: "Bokutlevering midt i den travleste uka",
    text: "Hele skolen skal ha bøker samtidig. Biblioteket bruker skolestarten på kø og lister i stedet for på elevene.",
  },
  {
    icon: <IconFileInvoice size={26} />,
    title: "Etterarbeid med tapte bøker",
    text: "Elever som mister bøker gir fakturaer, purringer og oppfølging langt inn i neste semester.",
  },
  {
    icon: <IconBoxSeam size={26} />,
    title: "Lagring over sommeren",
    text: "Tusenvis av bøker skal samles inn, telles, lagres og deles ut igjen. Det krever plass og folk.",
  },
  {
    icon: <IconBookOff size={26} />,
    title: "Elevene mangler bøker om sommeren",
    text: "Neste års pensum står innelåst i to måneder, akkurat når elevene har tid til å komme i forkant.",
  },
];

export default function Challenges() {
  return (
    <section className={classes.section}>
      <Container size="lg">
        <SectionHeading
          title="Kjenner dere igjen gamlemåten?"
          lead="Bøker som samles inn i juni og deles ut i august gir skolen mye arbeid i de to ukene av året som allerede er travlest."
        />
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={{ base: "xl", md: 40 }}>
          {CHALLENGES.map((challenge) => (
            <Group key={challenge.title} wrap="nowrap" align="flex-start" gap="md">
              <div className={classes.iconBadge}>{challenge.icon}</div>
              <Stack gap={6}>
                <Title order={3} size="h4">
                  {challenge.title}
                </Title>
                <Text c="dimmed">{challenge.text}</Text>
              </Stack>
            </Group>
          ))}
        </SimpleGrid>
      </Container>
    </section>
  );
}
