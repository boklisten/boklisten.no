import { Button, Divider, Stack, Text, Timeline } from "@mantine/core";
import { modals } from "@mantine/modals";
import { IconHelp } from "@tabler/icons-react";
import { Image } from "@unpic/react";

import SuccessAlert from "@/shared/components/alerts/SuccessAlert";

const ScannerTutorial = () => {
  return (
    <Button
      leftSection={<IconHelp />}
      onClick={() =>
        modals.open({
          title: "Hvordan skanne bøker",
          size: "lg",
          children: (
            <Timeline active={-1} bulletSize={30} lineWidth={2}>
              <Timeline.Item bullet={1} title={"Finn bokas unike ID"}>
                <Stack gap={"xs"}>
                  <Text c={"dimmed"} fz={"sm"}>
                    Den ser slik ut:
                  </Text>
                  <Image
                    src={"/ullernUID.png"}
                    alt={"Ullern VGS unik ID"}
                    width={300}
                    height={150}
                  />
                  <Divider label={"Eller"} />
                  <Image src={"/blid.jpg"} alt={"BLID"} width={300} height={150} />
                  <Text c={"dimmed"} fz={"sm"} fs={"italic"}>
                    Sliter du med å finne IDen? Sjekk innsiden av boka, eller be om hjelp fra
                    kontaktelev eller stand.
                  </Text>
                </Stack>
              </Timeline.Item>

              <Timeline.Item bullet={2} title={"Skann eller skriv inn IDen"}>
                <Text c={"dimmed"} fz={"sm"}>
                  Gjenta til du har skannet alle bøkene du skal ha.
                </Text>
              </Timeline.Item>

              <Timeline.Item bullet={3} title={"Sjekk at alt er registrert"}>
                <Stack gap={"xs"}>
                  <Text c={"dimmed"} fz={"sm"}>
                    Når du har skannet alle bøkene, får du denne bekreftelsen. Sjekk at den som ga
                    deg bøkene også har fått grønt merke.
                  </Text>
                  <SuccessAlert>Du har skannet alle bøkene for denne overleveringen.</SuccessAlert>
                </Stack>
              </Timeline.Item>
            </Timeline>
          ),
        })
      }
    >
      Vis instruksjoner
    </Button>
  );
};

export default ScannerTutorial;
