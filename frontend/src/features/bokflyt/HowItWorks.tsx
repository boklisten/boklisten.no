import { Container, Stack, Text, Title } from "@mantine/core";
import { motion, useInView, useScroll } from "motion/react";
import type { ReactNode } from "react";
import { useRef } from "react";

import classes from "@/features/bokflyt/bokflyt.module.css";
import SectionHeading from "@/features/bokflyt/SectionHeading";
import AgreementFigure from "@/features/bokflyt/steps/AgreementFigure";
import ExportFigure from "@/features/bokflyt/steps/ExportFigure";
import HandoverFigure from "@/features/bokflyt/steps/HandoverFigure";
import MatchGraph from "@/features/bokflyt/steps/MatchGraph";
import SignatureFlow from "@/features/bokflyt/steps/SignatureFlow";

interface StepContent {
  title: string;
  text: string;
  figure: ReactNode;
}

const STEPS: StepContent[] = [
  {
    title: "Signer databehandleravtalen",
    text: "Vi behandler elevopplysninger på vegne av skolen, så vi begynner med en databehandleravtale. Den er standard og tar få minutter å gå gjennom.",
    figure: <AgreementFigure />,
  },
  {
    title: "Send oss elevlister og bestillinger",
    text: "Vi hjelper dere med å eksportere oversikten over hvem som har hvilke bøker fra biblioteksystemet deres, sammen med elevlister og fagvalg. Elevene trenger ikke gjøre noe selv.",
    figure: <ExportFigure />,
  },
  {
    title: "Elev eller foresatt signerer låneavtalen",
    text: "Hver elev får SMS og e-post med lenke til avtalen. Er eleven under 18, går lenken til foresatt. Signeringen gjøres på mobilen.",
    figure: <SignatureFlow />,
  },
  {
    title: "Vi setter opp overleveringene",
    text: "Vår algoritme finner ut hvem som skal gi bøker til hvem, og setter opp tid og sted.",
    figure: <MatchGraph />,
  },
  {
    title: "Elevene møtes og bytter bøker",
    text: "Hver elev ser hvem de skal møte, hvor og når, og hvilke bøker som skal byttes. Overleveringen bekreftes ved å skanne bøkene, så vi alltid vet hvor hver bok er. De få som må innom stand, får tid og sted.",
    figure: <HandoverFigure />,
  },
];

function Step({ index, step }: { index: number; step: StepContent }) {
  const ref = useRef<HTMLLIElement>(null);
  const reached = useInView(ref, { once: true, margin: "0px 0px -35% 0px" });

  return (
    <li ref={ref} className={classes.step}>
      <span
        className={`${classes.stepMarker} ${reached ? classes.stepMarkerActive : ""}`}
        aria-hidden
      >
        {index}
      </span>
      <Stack gap="sm">
        <Title order={3} className={`${classes.display} ${classes.stepTitle}`}>
          {step.title}
        </Title>
        <Text className={classes.lead} fz="md">
          {step.text}
        </Text>
      </Stack>
      <div className={classes.stepFigure}>{step.figure}</div>
    </li>
  );
}

export default function HowItWorks() {
  const listRef = useRef<HTMLOListElement>(null);
  const { scrollYProgress } = useScroll({
    target: listRef,
    offset: ["start 0.65", "end 0.65"],
  });

  return (
    <section className={`${classes.section} ${classes.wash}`} id="slik-kommer-dere-i-gang">
      <Container size="lg">
        <SectionHeading
          title="Slik kommer dere i gang"
          lead="Fem steg fra første møte til at elevene bytter bøker med hverandre. Skolen gjør de to første, resten tar vi."
        />
        <div style={{ position: "relative" }}>
          <div className={classes.rail} aria-hidden>
            <motion.div className={classes.railFill} style={{ scaleY: scrollYProgress }} />
          </div>
          <ol ref={listRef} className={classes.steps}>
            {STEPS.map((step, index) => (
              <Step key={step.title} index={index + 1} step={step} />
            ))}
          </ol>
        </div>
      </Container>
    </section>
  );
}
