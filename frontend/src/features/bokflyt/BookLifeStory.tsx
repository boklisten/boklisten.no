import type {
  BlidHistoryEvent,
  BlidParty,
  BlidSearchResult,
} from "@boklisten/backend/shared/blid_search";
import { Container, Stack, Text, Title } from "@mantine/core";
import { IconCircleCheck } from "@tabler/icons-react";

import BlidBookHeader from "@/features/blid-search/BlidBookHeader";
import BlidHistoryTimeline from "@/features/blid-search/BlidHistoryTimeline";
import BlidLabel from "@/features/bokflyt/BlidLabel";
import classes from "@/features/bokflyt/bokflyt.module.css";

const BRANCH = "Ullern VG2 ST";
const STAND: BlidParty = { type: "stand" };

function student(detailsId: string, name: string): BlidParty {
  return { type: "customer", detailsId, name };
}

/**
 * A real book from Ullern, exactly as its history reads in our admin tool. The book, the
 * dates and the deadlines are the real ones; the students' names are made up, and the id
 * is an example.
 */
const AMALIE = student("amalie", "Amalie Strand");
const HENRIK = student("henrik", "Henrik Dahl");
const INGRID = student("ingrid", "Ingrid Moen");
const SANDER = student("sander", "Sander Lie");
const TUVA = student("tuva", "Tuva Berg");

function transfer(
  time: string,
  from: BlidParty,
  to: BlidParty,
  deadline: string,
): BlidHistoryEvent {
  return {
    time,
    action: "match-transfer",
    from,
    to,
    byCustomer: true,
    branchName: BRANCH,
    deadline,
  };
}

const EXAMPLE_BOOK: BlidSearchResult = {
  blid: "eksempelBLID",
  book: { title: "Mønster R1 2021", isbn: "9788205548718" },
  status: "handed-out",
  history: [
    transfer("2026-06-17T12:31:00+02:00", SANDER, TUVA, "2027-07-01T00:00:00+02:00"),
    transfer("2025-06-18T11:52:00+02:00", INGRID, SANDER, "2026-07-01T00:00:00+02:00"),
    transfer("2024-06-19T13:07:00+02:00", HENRIK, INGRID, "2025-06-30T00:00:00+02:00"),
    transfer("2023-06-19T12:44:00+02:00", AMALIE, HENRIK, "2024-06-30T00:00:00+02:00"),
    {
      time: "2022-08-24T10:12:00+02:00",
      action: "handout",
      from: STAND,
      to: AMALIE,
      employee: { detailsId: "ansatt", name: "en ansatt" },
      byCustomer: false,
      branchName: BRANCH,
      deadline: "2023-06-30T00:00:00+02:00",
      handoutType: "rent",
    },
  ],
};

const FACTS = [
  "Fire overleveringer, fem elever, samme bok.",
  "Ingen innsamling, ingen lagring, ingen kø.",
  "Vi vet til enhver tid hvem som har den.",
];

/** Proof from the field: one book's custody chain, shown with the admin tool's own components. */
export default function BookLifeStory() {
  return (
    <section className={`${classes.section} ${classes.proof}`} id="ekte-eksempel">
      <Container size="lg">
        <div className={classes.proofGrid}>
          <Stack gap="lg">
            <Title
              order={2}
              className={`${classes.display} ${classes.sectionTitle} ${classes.onDeep}`}
            >
              Denne boka har ikke vært innom en ansatt siden 2022.
            </Title>
            <Text className={`${classes.lead} ${classes.onDeepMuted}`}>
              Et ekte eksempel fra Ullern videregående skole. Matematikkboka ble delt ut på stand i
              august 2022. Siden har den gått rett fra elev til elev hver juni, og hver gang har
              eleven som overtok den, skannet den inn selv.
            </Text>
            <ul className={classes.proofFacts}>
              {FACTS.map((fact) => (
                <li key={fact}>
                  <IconCircleCheck size={22} aria-hidden />
                  <span>{fact}</span>
                </li>
              ))}
            </ul>
            <Text size="sm" className={classes.onDeepMuted}>
              Slik ser boka ut i verktøyet vårt. Datoene er ekte, navnene er byttet ut.
            </Text>
          </Stack>

          <div className={`${classes.proofCard} ${classes.noInteraction}`} inert>
            <Stack gap="md">
              <BlidBookHeader result={EXAMPLE_BOOK} />
              <div className={classes.proofLabel}>
                <BlidLabel id={EXAMPLE_BOOK.blid} />
              </div>
              <BlidHistoryTimeline history={EXAMPLE_BOOK.history} />
            </Stack>
          </div>
        </div>
      </Container>
    </section>
  );
}
