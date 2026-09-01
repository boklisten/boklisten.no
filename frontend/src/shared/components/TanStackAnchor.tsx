import { createLink } from "@tanstack/react-router";
import type { LinkComponent } from "@tanstack/react-router";
import { Anchor } from "@mantine/core";
import type { AnchorProps } from "@mantine/core";
import { forwardRef } from "react";

const MantineLinkComponent = forwardRef<HTMLAnchorElement, Omit<AnchorProps, "href">>(
  (props, ref) => <Anchor ref={ref} {...props} />,
);

const CreatedLinkComponent = createLink(MantineLinkComponent);

const TanStackAnchor: LinkComponent<typeof MantineLinkComponent> = (props) => (
  <CreatedLinkComponent preload="viewport" {...props} />
);

export default TanStackAnchor;
