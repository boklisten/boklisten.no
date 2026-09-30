import { Container, Stack, Text, Title } from "@mantine/core";
import { Image } from "@unpic/react";

import classes from "@/features/frontpage/frontpage.module.css";

const STEPS = [
  {
    image: "/images/select_items.webp",
    title: "Velg",
    text: "Lag en bruker, velg skolen din og fagene du tar.",
  },
  {
    image: "/images/get_items.webp",
    title: "Hent",
    text: "Hent bøkene på standen vår på skolen, eller få dem sendt i posten.",
  },
  {
    image: "/images/read_items.webp",
    title: "Les",
    text: "Nå er det bare å sette seg ned for å studere.",
  },
  {
    image: "/images/deliver_items.webp",
    title: "Lever",
    text: "Når fristen nærmer seg må elever levere tilbake bøkene på stand ved skolen. Er du privatist, kjøper vi tilbake de fleste bøkene dine, og da slipper du siste avdrag. Passer det ikke å møte opp, kan du sende bøkene i posten.",
  },
] as const;

export default function Steps() {
  return (
    <section className={classes.section} aria-labelledby="slik-funker-det">
      <Container size="lg">
        <Stack gap="xl">
          <Title
            order={2}
            id="slik-funker-det"
            className={`${classes.display} ${classes.sectionTitle}`}
          >
            Slik funker det
          </Title>
          <ol className={classes.steps}>
            {STEPS.map((step) => (
              <li key={step.title} className={classes.step}>
                <Image
                  src={step.image}
                  alt=""
                  width={72}
                  height={72}
                  className={classes.stepFigure}
                />
                <div className={classes.stepText}>
                  <Title order={3} className={`${classes.display} ${classes.stepTitle}`}>
                    {step.title}
                  </Title>
                  <Text className={classes.body}>{step.text}</Text>
                </div>
              </li>
            ))}
          </ol>
        </Stack>
      </Container>
    </section>
  );
}
