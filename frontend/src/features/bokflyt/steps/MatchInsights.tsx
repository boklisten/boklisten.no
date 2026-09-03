import { describeMatchConfig } from "@boklisten/backend/shared/match/match-statistics";
import type {
  MatchConfigDistributionEntry,
  StudentReachSummary,
} from "@boklisten/backend/shared/match/match-statistics";
import { Skeleton } from "@mantine/core";
import { ClientOnly } from "@tanstack/react-router";
import { useInView } from "motion/react";
import { useRef } from "react";

import Reveal from "@/features/bokflyt/Reveal";
import { useCountUp } from "@/features/bokflyt/useCountUp";
import RoundOverview from "@/features/matches/insights/RoundOverview";

const USER_MATCHES = 356;
const STAND_MATCHES = 61;

const STUDENT_REACH: StudentReachSummary = {
  totalStudents: 412,
  onlyUserHandovers: 318,
  mustVisitStand: 94,
};

function entry(
  userMatches: number,
  standMatches: number,
  students: number,
): MatchConfigDistributionEntry {
  return { ...describeMatchConfig(userMatches, standMatches), students };
}

const DISTRIBUTION: MatchConfigDistributionEntry[] = [
  entry(1, 0, 121),
  entry(2, 0, 164),
  entry(3, 0, 33),
  entry(1, 1, 58),
  entry(2, 1, 21),
  entry(0, 1, 15),
];

/** The same overview an administrator sees after a round is generated, with the counts ticking up. */
export default function MatchInsights() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.3 });
  const userMatchCount = useCountUp(USER_MATCHES, inView);
  const standMatchCount = useCountUp(STAND_MATCHES, inView);

  return (
    <div ref={ref} aria-label="Statistikk for en overleveringsrunde">
      <Reveal>
        <ClientOnly fallback={<Skeleton height={640} />}>
          <RoundOverview
            userMatchCount={userMatchCount}
            standMatchCount={standMatchCount}
            studentReach={STUDENT_REACH}
            distribution={DISTRIBUTION}
          />
        </ClientOnly>
      </Reveal>
    </div>
  );
}
