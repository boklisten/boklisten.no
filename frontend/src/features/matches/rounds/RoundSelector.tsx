import { ColorSwatch, Select } from "@mantine/core";

import { isPlanned } from "@/features/matches/rounds/useRounds";
import type { Round } from "@/features/matches/rounds/useRounds";

/**
 * Picks which round is being looked at. The dot tells the three states apart at a glance: blue for
 * a round that is still only planned, green once it is generated and students can see it, gray for
 * a generated round held back as a draft.
 */
function swatchColor(round: Round | undefined): string {
  if (round === undefined) {
    return "var(--mantine-color-gray-5)";
  }
  if (isPlanned(round)) {
    return "var(--mantine-color-blue-5)";
  }
  return round.status === "active" ? "var(--mantine-color-green-6)" : "var(--mantine-color-gray-5)";
}

function roundLabel(round: Round): string {
  if (isPlanned(round)) {
    return `${round.name} (planlagt)`;
  }
  return round.status === "active" ? round.name : `${round.name} (utkast)`;
}

export default function RoundSelector({
  rounds,
  selectedRoundId,
  onSelect,
}: {
  rounds: Round[];
  selectedRoundId: string | null;
  onSelect: (roundId: string) => void;
}) {
  if (rounds.length === 0) {
    return null;
  }

  const selected = rounds.find((round) => round.id === selectedRoundId);

  return (
    <Select
      aria-label="Runde"
      w={280}
      allowDeselect={false}
      leftSection={<ColorSwatch size={10} color={swatchColor(selected)} />}
      value={selectedRoundId}
      onChange={(value) => value && onSelect(value)}
      data={rounds.map((round) => ({
        value: round.id,
        label: roundLabel(round),
      }))}
    />
  );
}
