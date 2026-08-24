import { Button, type ButtonProps } from "@mantine/core";
import { createLink, type LinkComponent } from "@tanstack/react-router";
import { forwardRef } from "react";

const MantineButtonComponent = forwardRef<HTMLAnchorElement, ButtonProps>((props, ref) => {
  return <Button ref={ref} component={"a"} {...props} />;
});

const CreatedLinkComponent = createLink(MantineButtonComponent);

/** Mantine Button that navigates with typed TanStack Router links. */
const TanStackButton: LinkComponent<typeof MantineButtonComponent> = (props) => {
  return <CreatedLinkComponent preload={"viewport"} {...props} />;
};

export default TanStackButton;
