import { createLink } from "@tanstack/react-router";
import type { LinkComponent } from "@tanstack/react-router";
import { Anchor } from "@mantine/core";
import type { AnchorProps } from "@mantine/core";
import { forwardRef } from "react";

const MantineLinkComponent = forwardRef<HTMLAnchorElement, Omit<AnchorProps, "href">>(
  // oxlint-disable-next-line react/function-component-definition
  (props, ref) => <Anchor ref={ref} {...props} />,
);
MantineLinkComponent.displayName = "MantineLinkComponent";

const CreatedLinkComponent = createLink(MantineLinkComponent);

// oxlint-disable-next-line react/function-component-definition
const TanStackAnchor: LinkComponent<typeof MantineLinkComponent> = (props) => (
  <CreatedLinkComponent preload="viewport" {...props} />
);

export default TanStackAnchor;
