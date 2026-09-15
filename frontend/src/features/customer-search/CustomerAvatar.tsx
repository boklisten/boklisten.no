import { Avatar as Critter, Style } from "@dicebear/core";
import critters from "@dicebear/styles/critters.json";
import { Avatar, Image, Modal, UnstyledButton } from "@mantine/core";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";

// One parsed style for the whole app; parsing the definition is the expensive part.
const critterStyle = new Style(critters);

type CustomerAvatarProps = { detailsId: string } & (
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
  const src = useMemo(
    () => new Critter(critterStyle, { seed: props.detailsId }).toDataUri(),
    [props.detailsId],
  );
  const avatar = <Avatar src={src} alt="" radius="xl" />;
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
