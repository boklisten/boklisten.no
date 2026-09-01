import { Button } from "@mantine/core";
import type { ButtonProps } from "@mantine/core";
import { createLink } from "@tanstack/react-router";
import type { LinkComponent } from "@tanstack/react-router";
import { forwardRef } from "react";

// oxlint-disable-next-line react/function-component-definition
const MantineButtonComponent = forwardRef<HTMLAnchorElement, ButtonProps>((props, ref) => (
  <Button ref={ref} component="a" {...props} />
));
MantineButtonComponent.displayName = "MantineButtonComponent";

const CreatedLinkComponent = createLink(MantineButtonComponent);

/** Mantine Button that navigates with typed TanStack Router links. */
// oxlint-disable-next-line react/function-component-definition
const TanStackButton: LinkComponent<typeof MantineButtonComponent> = (props) => (
  <CreatedLinkComponent preload="viewport" {...props} />
);

export default TanStackButton;
