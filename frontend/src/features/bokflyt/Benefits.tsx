import { Container, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import {
  IconAdjustments,
  IconCalendarCheck,
  IconHome,
  IconReceipt,
  IconShieldCheck,
  IconSun,
} from "@tabler/icons-react";
import type { ReactNode } from "react";

import classes from "@/features/bokflyt/bokflyt.module.css";
import SectionHeading from "@/features/bokflyt/SectionHeading";

const BENEFITS: { icon: ReactNode; title: string; text: string }[] = [
  {
    icon: <IconCalendarCheck size={26} />,
    title: "Mindre logistikk ved semesterstart",
    text: "Elevene ordner overleveringene selv, i stedet for at biblioteket deler ut bok for bok.",
  },
  {
    icon: <IconReceipt size={26} />,
    title: "Vi følger opp tapte bøker",
    text: "Purring, fakturering og oppfølging av elever som ikke leverer, tar vi oss av.",
  },
  {
    icon: <IconSun size={26} />,
    title: "Elevene får bøkene før sommeren",
    text: "De fleste bøkene bytter eier i juni. Elever som vil, kan lese seg opp i ferien, og den som merker at spansk passer bedre enn tysk, kan bytte fag før skolestart.",
  },
  {
    icon: <IconHome size={26} />,
    title: "Ingen lagring over sommeren",
    text: "Bøkene står hjemme hos eleven som skal bruke dem, ikke i skolens boklager.",
  },
  {
    icon: <IconShieldCheck size={26} />,
    title: "Robust for unntakene",
    text: "Har elever byttet bøker seg imellom? Er det nytt pensum? Vi håndterer det, og deler ut fra stand med mobilen når det trengs.",
  },
  {
    icon: <IconAdjustments size={26} />,
    title: "Tilpasset skolen deres",
    text: "Vi setter opp ordningen rundt deres fagtilbud, boklister og kalender, ikke omvendt.",
  },
];

export default function Benefits() {
  return (
    <section className={classes.section}>
      <Container size="lg">
        <SectionHeading
          title="Det skolen sitter igjen med"
          lead="Bokflyt tar hele ansvaret for at bøkene kommer frem, kommer tilbake og blir betalt for."
        />
        <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing={{ base: "xl", md: 40 }}>
          {BENEFITS.map((benefit) => (
            <Stack key={benefit.title} gap="sm">
              <div className={classes.iconBadge}>{benefit.icon}</div>
              <Title order={3} size="h4">
                {benefit.title}
              </Title>
              <Text c="dimmed">{benefit.text}</Text>
            </Stack>
          ))}
        </SimpleGrid>
      </Container>
    </section>
  );
}
