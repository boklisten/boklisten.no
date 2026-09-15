import { useReducedMotion } from "motion/react";
import { useId } from "react";

import classes from "@/features/bokflyt/bokflyt.module.css";
import { MOCK_BOOKS } from "@/features/bokflyt/mockBooks";
import type { MockBook } from "@/features/bokflyt/mockBooks";
import { personaAvatar } from "@/features/bokflyt/personas";
import type { Persona } from "@/features/bokflyt/personas";
import SvgBookCover from "@/features/bokflyt/SvgBookCover";
import { BOKFLYT_COLORS } from "@/features/bokflyt/theme";

const { light: LIGHT, ink: INK } = BOKFLYT_COLORS;

interface Person {
  x: number;
  name: Persona;
  detail: string;
}

const PEOPLE: Person[] = [
  { x: 100, name: "Peer", detail: "går ut av VG3" },
  { x: 273, name: "Ronja", detail: "starter i VG3" },
  { x: 447, name: "Espen", detail: "starter i VG2" },
  { x: 620, name: "Pippi", detail: "starter i VG1" },
];

const AVATAR_Y = 170;
const AVATAR_R = 52;
const COVER = { width: 40, height: 54 };

interface Arc {
  key: string;
  d: string;
  /** The point halfway along the curve, where a book rests when motion is off. */
  mid: [number, number];
  begin: number;
  /** The books this student hands on, one per pass; the same set as in the matching step. */
  books: MockBook[];
}

/** Books travelling along the chain, one student to the next. */
const CHAIN: Arc[] = [
  {
    key: "peer-ronja",
    d: "M 144 142 Q 186 20 229 142",
    mid: [186, 81],
    begin: 0,
    books: [MOCK_BOOKS.religionOgEtikk, MOCK_BOOKS.matematikkR2, MOCK_BOOKS.gripTekstenVg3],
  },
  {
    key: "ronja-espen",
    d: "M 317 142 Q 360 20 403 142",
    mid: [360, 81],
    begin: 1.2,
    books: [MOCK_BOOKS.tidslinjer1, MOCK_BOOKS.kraft1, MOCK_BOOKS.psykologi1],
  },
  {
    key: "espen-pippi",
    d: "M 491 142 Q 534 20 576 142",
    mid: [534, 81],
    begin: 2.4,
    books: [MOCK_BOOKS.gripTekstenVg1, MOCK_BOOKS.fokusSamfunnskunnskap, MOCK_BOOKS.pasos],
  },
];

/** One pass along an arc; an arc with several books shows them in turn, one pass each. */
const PASS_S = 3.6;

/** The student as a bust straight on the page: no disc or ring, just the face. */
function PersonNode({ person }: { person: Person }) {
  const size = AVATAR_R * 2;
  return (
    <g>
      <image
        href={personaAvatar(person.name)}
        x={person.x - AVATAR_R}
        y={AVATAR_Y - AVATAR_R}
        width={size}
        height={size}
      />
      <text
        x={person.x}
        y={256}
        textAnchor="middle"
        fontSize={17}
        fontWeight={600}
        fill={INK}
        fontFamily="var(--bf-display)"
      >
        {person.name}
      </text>
      <text x={person.x} y={276} textAnchor="middle" fontSize={13} fill="#5b6e79">
        {person.detail}
      </text>
    </g>
  );
}

/**
 * The books on one arc. Each book owns a slot of the arc's cycle: it travels during its slot
 * and stays hidden for the rest, so the books take turns without ever overlapping.
 */
function ChainBooks({ arc, animated }: { arc: Arc; animated: boolean }) {
  if (!animated) {
    return (
      <g transform={`translate(${arc.mid[0]} ${arc.mid[1]})`}>
        <SvgBookCover book={arc.books[0]!} width={COVER.width} height={COVER.height} />
      </g>
    );
  }

  const slots = arc.books.length;
  const cycle = `${PASS_S * slots}s`;
  const slot = 1 / slots;
  // Hidden until its first slot starts, and again once the animation hands back the base value.
  return arc.books.map((book, index) => (
    <g key={book.isbn} opacity={0}>
      <SvgBookCover book={book} width={COVER.width} height={COVER.height} />
      <animateMotion
        dur={cycle}
        begin={`${arc.begin + PASS_S * index}s`}
        repeatCount="indefinite"
        path={arc.d}
        calcMode="linear"
        keyPoints="0;1;1"
        keyTimes={`0;${slot};1`}
      />
      <animate
        attributeName="opacity"
        values="0;1;1;0;0"
        keyTimes={`0;${0.12 * slot};${0.88 * slot};${slot};1`}
        dur={cycle}
        begin={`${arc.begin + PASS_S * index}s`}
        repeatCount="indefinite"
      />
    </g>
  ));
}

/**
 * The hero illustration: four students in a row, a book travelling from each
 * to the next. The stand is deliberately left out; the caption covers it.
 */
export default function BookFlowDiagram() {
  const reduceMotion = useReducedMotion();
  const id = useId();
  const arrowId = `${id}-arrow`;
  const animated = !reduceMotion;

  return (
    <svg
      viewBox="0 0 720 290"
      className={classes.diagram}
      role="img"
      aria-label="Bøker går fra Peer, som går ut av VG3, til Ronja, som starter i VG3, videre til Espen, som starter i VG2, og til Pippi, som starter i VG1."
    >
      <defs>
        <marker
          id={arrowId}
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill={LIGHT} />
        </marker>
      </defs>

      {CHAIN.map((arc) => (
        <path
          key={arc.key}
          d={arc.d}
          fill="none"
          stroke={LIGHT}
          strokeWidth={3}
          strokeLinecap="round"
          markerEnd={`url(#${arrowId})`}
        />
      ))}

      {PEOPLE.map((person) => (
        <PersonNode key={person.name} person={person} />
      ))}

      {CHAIN.map((arc) => (
        <ChainBooks key={arc.key} arc={arc} animated={animated} />
      ))}
    </svg>
  );
}
