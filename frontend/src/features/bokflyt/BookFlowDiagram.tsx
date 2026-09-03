import { useReducedMotion } from "motion/react";
import { useId } from "react";

import classes from "@/features/bokflyt/bokflyt.module.css";
import { BOKFLYT_COLORS } from "@/features/bokflyt/theme";

const { deep: DEEP, light: LIGHT, ink: INK } = BOKFLYT_COLORS;

interface Person {
  x: number;
  name: string;
  detail: string;
  color: string;
}

const PEOPLE: Person[] = [
  { x: 100, name: "Peer", detail: "går ut av VG3", color: DEEP },
  { x: 273, name: "Ronja", detail: "starter i VG3", color: LIGHT },
  { x: 447, name: "Espen", detail: "starter i VG2", color: DEEP },
  { x: 620, name: "Pippi", detail: "starter i VG1", color: LIGHT },
];

interface Arc {
  key: string;
  d: string;
  /** The point halfway along the curve, where a book rests when motion is off. */
  mid: [number, number];
  begin: string;
}

/** Books travelling along the chain, one student to the next. */
const CHAIN: Arc[] = [
  { key: "jonas-nora", d: "M 118 114 Q 186 20 255 114", mid: [186, 67], begin: "0s" },
  { key: "nora-emil", d: "M 291 114 Q 360 20 429 114", mid: [360, 67], begin: "1.2s" },
  { key: "emil-sara", d: "M 465 114 Q 534 20 602 114", mid: [534, 67], begin: "2.4s" },
];

const BOOK_DURATION = "3.6s";

function PersonNode({ person }: { person: Person }) {
  return (
    <g>
      <circle cx={person.x} cy={150} r={24} fill={person.color} />
      <path d={`M ${person.x - 44} 224 A 44 44 0 0 1 ${person.x + 44} 224 Z`} fill={person.color} />
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

function BookCover() {
  return (
    <g transform="translate(-14 -10)">
      <rect width={28} height={20} rx={2.5} fill={DEEP} />
      <rect x={3} width={3.5} height={20} fill={LIGHT} />
      <rect x={10} y={5} width={13} height={2.5} rx={1} fill="#fff" opacity={0.8} />
      <rect x={10} y={10} width={9} height={2.5} rx={1} fill="#fff" opacity={0.6} />
    </g>
  );
}

function ChainBook({ arc, animated }: { arc: Arc; animated: boolean }) {
  if (!animated) {
    return (
      <g transform={`translate(${arc.mid[0]} ${arc.mid[1]})`}>
        <BookCover />
      </g>
    );
  }

  return (
    <g>
      <BookCover />
      <animateMotion dur={BOOK_DURATION} begin={arc.begin} repeatCount="indefinite" path={arc.d} />
      <animate
        attributeName="opacity"
        values="0;1;1;0"
        keyTimes="0;0.12;0.88;1"
        dur={BOOK_DURATION}
        begin={arc.begin}
        repeatCount="indefinite"
      />
    </g>
  );
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
        <ChainBook key={arc.key} arc={arc} animated={animated} />
      ))}
    </svg>
  );
}
