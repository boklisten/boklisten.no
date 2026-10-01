import type { User } from "@boklisten/backend/shared/user";
import { Avatar } from "@mantine/core";

import CustomerAvatar, { useCritter } from "@/features/customer-search/CustomerAvatar";
import type { IdentitySite } from "@/features/user/IdentityBadge";

/**
 * The logged-in user's face. bl-admin shows everyone, the user included, as their critter (see
 * `CustomerAvatar`), the face employees know customers by. The public site keeps it plain: Mantine's
 * initials, on the critter's own background colour, so the user is the same colour on both sites.
 */
export default function IdentityAvatar({
  user,
  name,
  site,
}: {
  user: Pick<User, "id">;
  /** The name the public site's initials are taken from. */
  name: string;
  site: IdentitySite;
}) {
  if (site === "public") {
    return <InitialsAvatar userId={user.id} name={name} />;
  }
  return <CustomerAvatar userId={user.id} />;
}

function InitialsAvatar({ userId, name }: { userId: string; name: string }) {
  const { background, text } = useCritter(userId);
  return (
    <Avatar
      name={name}
      radius="50%"
      flex="none"
      vars={() => ({ root: { "--avatar-bg": background, "--avatar-color": text } })}
    />
  );
}
