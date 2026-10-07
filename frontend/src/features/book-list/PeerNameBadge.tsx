import CustomerLink from "@/features/kasse/CustomerLink";
import type { PeerBook } from "@/features/customer-search/handoutBooks";
import useDisplayName from "@/features/customer-search/useDisplayName";
import { PeerBadge } from "@/shared/components/matches/matches-helper";

/** "Mottas fra Ola": the other student of an overlevering, linked to their Kasse view at the stand. */
export default function PeerNameBadge({
  label,
  peer,
  linked = false,
}: {
  label: string;
  peer: PeerBook;
  linked?: boolean;
}) {
  const displayName = useDisplayName();
  const name = displayName(peer.personName);
  return (
    <PeerBadge>
      {label}{" "}
      {linked && peer.personId !== null ? (
        <CustomerLink userId={peer.personId} inherit>
          {name}
        </CustomerLink>
      ) : (
        name
      )}
    </PeerBadge>
  );
}
