import { Group, Stack, Text } from "@mantine/core";
import { motion, useInView, useReducedMotion } from "motion/react";
import { useRef } from "react";

import classes from "@/features/bokflyt/bokflyt.module.css";
import Reveal from "@/features/bokflyt/Reveal";
import { BOKFLYT_COLORS } from "@/features/bokflyt/theme";
import { useTimedPlayback } from "@/features/bokflyt/useTimedPlayback";
import type { PlaybackStep } from "@/features/bokflyt/useTimedPlayback";

const STAND = "stand";

/**
 * Seven students around a ring, clockwise from the top. The two who deal with
 * the stand sit on the right, nearest to it, so those arrows stay short.
 */
const STUDENTS = ["Espen", "Lillekort", "Tyrihans", "Solveig", "Kari", "Peer", "Ronja"] as const;

type Student = (typeof STUDENTS)[number];
type Node = Student | typeof STAND;

/** Which side of the node the name goes, chosen so no arrow runs through a name. */
const NAME_SIDE: Record<Student, "above" | "below" | "left"> = {
  Espen: "above",
  Lillekort: "above",
  Tyrihans: "below",
  Solveig: "below",
  Kari: "below",
  Peer: "left",
  Ronja: "left",
};

interface Transfer {
  from: Node;
  to: Node;
  title: string;
}

/**
 * One book per arrow. Peer hands his VG3 books to Ronja, who hands her VG2
 * books to Espen, and so on. Tyrihans has nobody to give to, so his set goes
 * to the stand; Lillekort has nobody to get from, so her set comes from it.
 */
const TRANSFERS: Transfer[] = [
  { from: "Peer", to: "Ronja", title: "Historie VG3" },
  { from: "Peer", to: "Ronja", title: "Matematikk R2" },
  { from: "Ronja", to: "Espen", title: "Matematikk R1" },
  { from: "Ronja", to: "Espen", title: "Fysikk 1" },
  { from: "Ronja", to: "Espen", title: "Norsk for VG2" },
  { from: "Kari", to: "Solveig", title: "Kjemi 1" },
  { from: "Kari", to: "Solveig", title: "Norsk for VG2" },
  { from: "Tyrihans", to: STAND, title: "Matematikk S1" },
  { from: "Tyrihans", to: STAND, title: "Samfunnsøkonomi 1" },
  { from: STAND, to: "Lillekort", title: "Matematikk R1" },
  { from: STAND, to: "Lillekort", title: "Fysikk 1" },
];

const VIA_STAND_COUNT = TRANSFERS.filter(
  (transfer) => transfer.from === STAND || transfer.to === STAND,
).length;

/** One arrow every 650 ms after a short pause, so the caption can be read. */
const STEPS: PlaybackStep<number>[] = TRANSFERS.map((_, index) => ({
  at: 900 + 650 * index,
  value: index + 1,
}));

const STUDENT_ARROW = BOKFLYT_COLORS.deep;
const STAND_ARROW = "#8a4b3b";

const WIDTH = 480;
const HEIGHT = 340;
const RING_CENTER = { x: 196, y: 172 };
const RING = 118;
const STAND_CENTER = { x: 424, y: 172 };
const NODE_R = 19;
const STAND_HALF = { x: 32, y: 20 };
const NAME_SIZE = 17;
const NAME_OFFSET = NODE_R + 8;

interface Point {
  x: number;
  y: number;
}

function positionOf(node: Node): Point {
  if (node === STAND) {
    return STAND_CENTER;
  }
  const angle = -Math.PI / 2 + (STUDENTS.indexOf(node) / STUDENTS.length) * 2 * Math.PI;
  return {
    x: RING_CENTER.x + RING * Math.cos(angle),
    y: RING_CENTER.y + RING * Math.sin(angle),
  };
}

function toward(from: Point, to: Point, distance: number): Point {
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  return {
    x: from.x + ((to.x - from.x) / length) * distance,
    y: from.y + ((to.y - from.y) / length) * distance,
  };
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}

interface Arrow extends Transfer {
  path: string;
  head: string;
  color: string;
}

/**
 * A gently curved arrow from the edge of one node to the edge of the other.
 * Several books between the same two parties fan out side by side.
 */
function arrowFor(transfer: Transfer, offset: number): Arrow {
  const from = positionOf(transfer.from);
  const to = positionOf(transfer.to);
  const viaStand = transfer.from === STAND || transfer.to === STAND;
  const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  const normal = { x: -(to.y - from.y) / length, y: (to.x - from.x) / length };
  // Ring chords bow towards the middle of the ring so they read as one network.
  const inward =
    Math.sign(normal.x * (RING_CENTER.x - mid.x) + normal.y * (RING_CENTER.y - mid.y)) || 1;
  const bulge = viaStand ? 8 : inward * 14;
  const control = {
    x: mid.x + normal.x * (bulge + offset),
    y: mid.y + normal.y * (bulge + offset),
  };

  const fromRadius = transfer.from === STAND ? STAND_HALF.x + 4 : NODE_R + 3;
  const toRadius = transfer.to === STAND ? STAND_HALF.x + 4 : NODE_R + 3;
  const start = toward(from, control, fromRadius);
  const tip = toward(to, control, toRadius);
  const end = toward(to, control, toRadius + 8);

  const direction = toward({ x: 0, y: 0 }, { x: tip.x - control.x, y: tip.y - control.y }, 1);
  const side = { x: -direction.y, y: direction.x };
  const base = { x: tip.x - direction.x * 10, y: tip.y - direction.y * 10 };
  const head = [
    tip,
    { x: base.x + side.x * 5, y: base.y + side.y * 5 },
    { x: base.x - side.x * 5, y: base.y - side.y * 5 },
  ]
    .map((point) => `${round(point.x)},${round(point.y)}`)
    .join(" ");

  return {
    ...transfer,
    path: `M ${round(start.x)} ${round(start.y)} Q ${round(control.x)} ${round(control.y)} ${round(end.x)} ${round(end.y)}`,
    head,
    color: viaStand ? STAND_ARROW : STUDENT_ARROW,
  };
}

const ARROWS: Arrow[] = TRANSFERS.map((transfer) => {
  const siblings = TRANSFERS.filter(
    (other) => other.from === transfer.from && other.to === transfer.to,
  );
  const index = siblings.indexOf(transfer);
  return arrowFor(transfer, (index - (siblings.length - 1) / 2) * 9);
});

const SUMMARY = `${TRANSFERS.length} bøker fordelt mellom ${STUDENTS.length} elever, ${VIA_STAND_COUNT} av dem via stand.`;

function captionFor(transfer: Transfer | undefined, finished: boolean) {
  if (finished) {
    return SUMMARY;
  }
  if (!transfer) {
    return "Finner ut hvem som skal gi bøker til hvem …";
  }
  if (transfer.from === STAND) {
    return `${transfer.to} får ${transfer.title} på standen.`;
  }
  if (transfer.to === STAND) {
    return `${transfer.from} leverer ${transfer.title} på standen.`;
  }
  return `${transfer.from} gir ${transfer.title} til ${transfer.to}.`;
}

function nameLayout(student: Student) {
  const { x, y } = positionOf(student);
  const side = NAME_SIDE[student];
  if (side === "above") {
    return { x, y: y - NAME_OFFSET, dy: "-0.1em", textAnchor: "middle" } as const;
  }
  if (side === "below") {
    return { x, y: y + NAME_OFFSET, dy: "0.85em", textAnchor: "middle" } as const;
  }
  return { x: x - NAME_OFFSET, y, dy: "0.35em", textAnchor: "end" } as const;
}

function StudentNode({ student, active }: { student: Student; active: boolean }) {
  const { x, y } = positionOf(student);
  const name = nameLayout(student);
  return (
    <g>
      <motion.circle
        cx={round(x)}
        cy={round(y)}
        r={NODE_R}
        stroke={STUDENT_ARROW}
        strokeWidth={2}
        initial={false}
        animate={{ fill: active ? STUDENT_ARROW : "#ffffff" }}
        transition={{ duration: 0.25 }}
      />
      <motion.text
        x={round(x)}
        y={round(y)}
        dy="0.36em"
        textAnchor="middle"
        fontSize={16}
        fontWeight={700}
        initial={false}
        animate={{ fill: active ? "#ffffff" : STUDENT_ARROW }}
        transition={{ duration: 0.25 }}
      >
        {student[0]}
      </motion.text>
      <text
        x={round(name.x)}
        y={round(name.y)}
        dy={name.dy}
        textAnchor={name.textAnchor}
        fontSize={NAME_SIZE}
        fill={BOKFLYT_COLORS.ink}
      >
        {student}
      </text>
    </g>
  );
}

function StandNode({ active }: { active: boolean }) {
  return (
    <g>
      <motion.rect
        x={STAND_CENTER.x - STAND_HALF.x}
        y={STAND_CENTER.y - STAND_HALF.y}
        width={STAND_HALF.x * 2}
        height={STAND_HALF.y * 2}
        rx={10}
        stroke={STAND_ARROW}
        strokeWidth={2}
        initial={false}
        animate={{ fill: active ? STAND_ARROW : "#ffffff" }}
        transition={{ duration: 0.25 }}
      />
      <motion.text
        x={STAND_CENTER.x}
        y={STAND_CENTER.y}
        dy="0.36em"
        textAnchor="middle"
        fontSize={16}
        fontWeight={700}
        initial={false}
        animate={{ fill: active ? "#ffffff" : STAND_ARROW }}
        transition={{ duration: 0.25 }}
      >
        Stand
      </motion.text>
    </g>
  );
}

function LegendSwatch({ color }: { color: string }) {
  return (
    <svg width={26} height={10} viewBox="0 0 26 10" aria-hidden>
      <line x1={1} y1={5} x2={18} y2={5} stroke={color} strokeWidth={2.5} strokeLinecap="round" />
      <polygon points="17,1 25,5 17,9" fill={color} />
    </svg>
  );
}

/**
 * The matching step as a small network: students in a ring, the stand off to
 * the side, and one arrow per book. The arrows draw in one by one while a
 * caption names each hand-off, then the scene starts over.
 */
export default function MatchGraph() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.4 });
  const animated = !(useReducedMotion() ?? false);
  const played = useTimedPlayback(0, STEPS, inView && animated);

  const shown = animated ? played : TRANSFERS.length;
  const finished = shown >= TRANSFERS.length;
  const current = finished ? undefined : TRANSFERS[shown - 1];
  const caption = captionFor(current, finished);
  const isActive = (node: Node) =>
    current !== undefined && (current.from === node || current.to === node);

  return (
    <Reveal>
      <div className={classes.graphFigure} ref={ref}>
        <Stack gap="sm">
          <svg
            className={classes.graphSvg}
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            role="img"
            aria-label={`Sju elever i en ring og standen ved siden av, med en pil for hver bok som bytter eier. ${SUMMARY}`}
          >
            {ARROWS.map((arrow, index) => {
              const drawn = index < shown;
              return (
                <g key={`${arrow.from}-${arrow.to}-${arrow.title}`}>
                  <title>{arrow.title}</title>
                  <motion.path
                    d={arrow.path}
                    fill="none"
                    stroke={arrow.color}
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    initial={false}
                    animate={{ pathLength: drawn ? 1 : 0, opacity: drawn ? 1 : 0 }}
                    transition={
                      drawn && animated ? { duration: 0.5, ease: "easeOut" } : { duration: 0.3 }
                    }
                  />
                  <motion.polygon
                    points={arrow.head}
                    fill={arrow.color}
                    initial={false}
                    animate={{ opacity: drawn ? 1 : 0 }}
                    transition={
                      drawn && animated ? { delay: 0.4, duration: 0.15 } : { duration: 0.3 }
                    }
                  />
                </g>
              );
            })}
            <StandNode active={isActive(STAND)} />
            {STUDENTS.map((student) => (
              <StudentNode key={student} student={student} active={isActive(student)} />
            ))}
          </svg>

          <Text ta="center" fz="sm" className={classes.graphCaption}>
            <motion.span
              key={caption}
              initial={animated ? { opacity: 0 } : false}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
              style={{ display: "block" }}
            >
              {caption}
            </motion.span>
          </Text>

          <Group justify="center" gap="lg">
            <Group gap={6}>
              <LegendSwatch color={STUDENT_ARROW} />
              <Text fz="xs" c="dimmed">
                Elev til elev
              </Text>
            </Group>
            <Group gap={6}>
              <LegendSwatch color={STAND_ARROW} />
              <Text fz="xs" c="dimmed">
                Via stand
              </Text>
            </Group>
          </Group>
        </Stack>
      </div>
    </Reveal>
  );
}
