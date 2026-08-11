import { Box, Container, Divider, Stack, Title } from "@mantine/core";

import Dots from "@/features/frontpage/Dots";
import EndButtons from "@/features/frontpage/EndButtons";
import { HeroImageBackground } from "@/features/frontpage/HeroImageBackground";
import HowToCard from "@/features/frontpage/HowToCard";
import QuickButtons from "@/features/frontpage/QuickButtons";
import PublicLayout from "@/features/PublicLayout";

import { createFileRoute } from "@tanstack/react-router";
import { seo } from "@/shared/utils/seo";

export const Route = createFileRoute("/")({
  head: () =>
    seo({
      title: "Boklisten.no – pensumbøker til videregående og privatister",
      description:
        "Bestill pensumbøkene du trenger: velg skolen din og fagene du tar, så finner vi bøkene. Hent dem på stand ved skolen eller i posten, og lever eller få dem kjøpt tilbake når du er ferdig.",
    }),
  component: Frontpage,
});

function Frontpage() {
  return (
    <PublicLayout padding={0} withBorder={false}>
      <Stack>
        <HeroImageBackground />
        <Container>
          <Stack align={"center"}>
            <QuickButtons />
            <Divider w={"100%"} />
            <Stack gap={0} align={"center"}>
              <Box p={"xl"} bd={"10px solid brand"} bdrs={50} w={"100%"}>
                <Title ta={"center"} order={2}>
                  Slik funker det
                </Title>
              </Box>
              <HowToCard
                image={"/select_items.png"}
                title={"Velg"}
                description={
                  "Lag deg en bruker og velg den skolen du går på. Deretter er det bare å velge de bøkene du trenger til de fagene du tar."
                }
              />

              <HowToCard
                image={"/get_items.png"}
                title={"Hent"}
                description={
                  "Etter at du har bestilt så er det bare å hente bøkene. Dette kan du gjøre når vi har stand på din skole."
                }
              />

              <HowToCard
                image={"/read_items.png"}
                title={"Les"}
                description={"Nå er det bare å sette seg ned for å studere."}
              />

              <HowToCard
                image={"/deliver_items.png"}
                title={"LEVER"}
                description={
                  "Når du har lest deg ferdig og fristen begynner å nærme seg må elever levere tilbake bøkene. Vi har stands på slutten av semesteret på de fleste skoler. Vi vil kunne kjøpe tilbake de fleste bøkene dine hvis du er privatist. Hvis vi kjøper boken din slipper du å betale siste avdrag. Levering og salg av bøker med post er mulig om det ikke passer å møte opp."
                }
              />
              <Dots />
              <Stack gap={"xs"} p={"xl"} bd={"10px solid brand"} bdrs={50} w={"100%"}>
                <Title ta={"center"} order={2}>
                  Hva venter du på?
                </Title>
                <EndButtons />
              </Stack>
            </Stack>
          </Stack>
        </Container>
      </Stack>
    </PublicLayout>
  );
}
