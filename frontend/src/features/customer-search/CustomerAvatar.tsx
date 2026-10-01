import { Avatar as Critter, Style } from "@dicebear/core";
import critters from "@dicebear/styles/critters.json";
import { Avatar, Image, Modal, UnstyledButton } from "@mantine/core";
import type { ReactNode } from "react";

import { readableOn } from "@/shared/utils/contrast";
import { useMemo, useState } from "react";

// One parsed style for the whole app; parsing the definition is the expensive part.
const critterStyle = new Style(critters);

/** The critter's ink, the dark of its outlines; the light text choice is white. */
const CRITTER_INK = "#1e293b";

/**
 * The user's critter and the background colour drawn for it, from the same seed. The public site
 * shows initials on that colour (see `IdentityAvatar`), with whichever text colour reads best on
 * it, so the contrast holds whatever palette a DiceBear update brings.
 */
export function useCritter(userId: string): { src: string; background: string; text: string } {
  return useMemo(() => {
    const critter = new Critter(critterStyle, { seed: userId });
    const background = critter.toJSON().options.backgroundColor?.[0] ?? CRITTER_INK;
    return {
      src: critter.toDataUri(),
      background,
      text: readableOn(background, ["#ffffff", CRITTER_INK]),
    };
  }, [userId]);
}

type CustomerAvatarProps = { userId: string } & (
  | { enlargeable?: false; name?: never }
  | {
      /** Opens larger on click, like a book cover. Off inside rows that are themselves buttons. */
      enlargeable: true;
      /** Titles the enlarged view; the name as it is shown next to the avatar. */
      name: string;
    }
);

/**
 * The customer's creature: a DiceBear critter drawn from the customer details id, so the same
 * customer always gets the same face and no personal data goes into the picture. Decorative, the
 * name always stands next to it. One size everywhere, so a customer looks the same in every list.
 */
export default function CustomerAvatar(props: CustomerAvatarProps) {
  const { src } = useCritter(props.userId);
  // A circle at any size (a fixed radius such as "xl" only rounds the small ones fully), and never
  // squeezed by a long name beside it.
  const avatar = <Avatar src={src} alt="" radius="50%" flex="none" />;
  return props.enlargeable ? <Enlargeable src={src} name={props.name} avatar={avatar} /> : avatar;
}

function Enlargeable({ src, name, avatar }: { src: string; name: string; avatar: ReactNode }) {
  const [enlarged, setEnlarged] = useState(false);
  return (
    <>
      <UnstyledButton
        display="flex"
        flex="none"
        bdrs="50%"
        aria-label={`Vis avataren til ${name} større`}
        onClick={() => setEnlarged(true)}
      >
        {avatar}
      </UnstyledButton>
      <Modal opened={enlarged} onClose={() => setEnlarged(false)} title={name} size="xs" centered>
        <Image src={src} alt={`Avataren til ${name}`} radius="50%" />
      </Modal>
    </>
  );
}
