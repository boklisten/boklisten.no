import { ColorSwatch, Select } from "@mantine/core";

import type { Round } from "@/features/matches/rounds/useRounds";

/**
 * Picks which round is being looked at. The dot mirrors the round's switch: green when the round
 * is active and visible to students, gray while it is a draft only admins can see.
 */
export default function RoundSelector({
  rounds,
  selectedRoundId,
  onSelect,
}: {
  rounds: Round[];
  selectedRoundId: string | null;
  onSelect: (roundId: string) => void;
}) {
  if (rounds.length === 0) return null;

  const selected = rounds.find((round) => round.id === selectedRoundId);
  const active = selected?.status === "active";

  return (
    <Select
      aria-label={"Runde"}
      w={280}
      allowDeselect={false}
      leftSection={
        <ColorSwatch
          size={10}
          color={active ? "var(--mantine-color-green-6)" : "var(--mantine-color-gray-5)"}
        />
      }
      value={selectedRoundId}
      onChange={(value) => value && onSelect(value)}
      data={rounds.map((round) => ({
        value: round.id,
        label: round.status === "active" ? round.name : `${round.name} (utkast)`,
      }))}
    />
  );
}
