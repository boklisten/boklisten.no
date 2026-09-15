import type {
  HandoverDto,
  HandoverParty,
  MatchDto,
  MatchObligationDto,
} from "@boklisten/backend/shared/match/match-dto";

import { MOCK_BOOKS } from "@/features/bokflyt/mockBooks";
import { inHandoverYear } from "@/features/bokflyt/mockDates";
import { forViewer } from "@/features/matches/forViewer";
import type { ViewerMatch, ViewerObligation } from "@/features/matches/forViewer";

/** The student whose phone we are looking at: Ronja, who starts VG3 and hands her VG2 books on. */
const VIEWER_ID = "nora";
/** The student receiving Ronja's books, who starts VG2. */
const RECEIVER_ID = "emil";

function student(customerId: string, name: string): HandoverParty {
  return { kind: "customer", customerId, name, phone: "", email: "" };
}

const RONJA = student(VIEWER_ID, "Ronja Røverdatter");
const ESPEN = student(RECEIVER_ID, "Espen Askeladd");
const PEER = student("peer", "Peer Gynt");
const STAND: HandoverParty = { kind: "stand" };

/** The books Ronja hands to Espen, in the order he scans them. */
export const HANDOVER_BOOKS = [
  { id: "tidslinjer", book: MOCK_BOOKS.tidslinjer1, blid: "K3fQ8pL2xA7d" },
  { id: "kraft", book: MOCK_BOOKS.kraft1, blid: "b9TzW4mR1cVq" },
  { id: "psykologi", book: MOCK_BOOKS.psykologi1, blid: "Hs6Ye2nP0dJk" },
] as const;

function handover(id: string, blid: string, from: HandoverParty, to: HandoverParty): HandoverDto {
  return { id, blid, occurredAt: inHandoverYear("06-16T12:20:00+02:00"), from, to };
}

/** Books outside the scanned handover only need some id. */
const OTHER_BLID = "10231170";

function obligation(
  id: string,
  title: string,
  sender: HandoverParty,
  receiver: HandoverParty,
  done: boolean,
  blid: string = OTHER_BLID,
): MatchObligationDto {
  const delivery = done ? handover(`${id}-handover`, blid, sender, receiver) : null;
  return {
    id,
    itemId: `item-${id}`,
    title,
    sender,
    receiver,
    senderHandover: delivery,
    receiverHandover: delivery,
  };
}

/** Ronja's matches, with the first `booksReceived` of her books to Espen already scanned. */
function matches(booksReceived: number): MatchDto[] {
  return [
    {
      id: "ronja-espen",
      roundId: "juni",
      isStandMatch: false,
      meetingLocation: "Utenfor biblioteket",
      meetingTime: inHandoverYear("06-16T12:15:00+02:00"),
      participants: [RONJA, ESPEN],
      obligations: HANDOVER_BOOKS.map((copy, index) =>
        obligation(copy.id, copy.book.title, RONJA, ESPEN, index < booksReceived, copy.blid),
      ),
    },
    {
      id: "ronja-stand",
      roundId: "juni",
      isStandMatch: true,
      meetingLocation: "Stand i kantina",
      meetingTime: inHandoverYear("08-18T10:00:00+02:00"),
      participants: [RONJA, STAND],
      obligations: [obligation("engelsk", "Engelsk 1, ny utgave", STAND, RONJA, false)],
    },
    {
      id: "peer-ronja",
      roundId: "juni",
      isStandMatch: false,
      meetingLocation: "Ved hovedinngangen",
      meetingTime: inHandoverYear("06-12T13:00:00+02:00"),
      participants: [PEER, RONJA],
      obligations: [
        obligation("religion", MOCK_BOOKS.religionOgEtikk.title, PEER, RONJA, true),
        obligation("r2", MOCK_BOOKS.matematikkR2.title, PEER, RONJA, true),
      ],
    },
  ];
}

/** Ronja's matches, exactly as the student page would present them. */
export function noraViewerMatches(booksReceived: number): ViewerMatch[] {
  return matches(booksReceived).map((match) => forViewer(match, VIEWER_ID));
}

/** What Espen's scanner lists while he receives Ronja's books. */
export function emilReceiving(booksReceived: number): ViewerObligation[] {
  return forViewer(matches(booksReceived)[0]!, RECEIVER_ID).toReceive;
}
