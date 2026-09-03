import { Stack } from "@mantine/core";
import { useInView, useReducedMotion } from "motion/react";
import { useMemo, useRef } from "react";

import classes from "@/features/bokflyt/bokflyt.module.css";
import { HANDOVER_BOOKS, noraViewerMatches } from "@/features/bokflyt/mockMatches";
import ReplayButton from "@/features/bokflyt/ReplayButton";
import Reveal from "@/features/bokflyt/Reveal";
import ScanFigure from "@/features/bokflyt/steps/ScanFigure";
import StudentMatches from "@/features/bokflyt/steps/StudentMatches";
import { useTimedPlayback } from "@/features/bokflyt/useTimedPlayback";
import type { PlaybackStep } from "@/features/bokflyt/useTimedPlayback";

/** Emil scans one book every 1.8 s from the moment the figure comes into view. */
const SCANS: PlaybackStep<number>[] = HANDOVER_BOOKS.map((_, index) => ({
  at: 1800 * (index + 1),
  value: index + 1,
}));

/**
 * Both sides of a handover: Emil scans the books he receives on his phone,
 * and Nora watches the match complete on hers.
 */
export default function HandoverFigure() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const reduceMotion = useReducedMotion() ?? false;
  const { value: booksReceived, replay } = useTimedPlayback(0, SCANS, inView && !reduceMotion);

  const shown = reduceMotion ? HANDOVER_BOOKS.length : booksReceived;
  const viewerMatches = useMemo(() => noraViewerMatches(shown), [shown]);

  return (
    <Reveal>
      <Stack gap="sm" ref={ref}>
        <div className={classes.phonePair}>
          <ScanFigure booksReceived={shown} animated={!reduceMotion} />
          <StudentMatches viewerMatches={viewerMatches} />
        </div>
        {!reduceMotion && <ReplayButton onClick={replay} />}
      </Stack>
    </Reveal>
  );
}
