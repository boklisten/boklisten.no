import { Button } from "@mantine/core";
import type { ButtonProps } from "@mantine/core";
import { createLink } from "@tanstack/react-router";
import type { LinkComponent } from "@tanstack/react-router";
import { forwardRef } from "react";
import type { ComponentPropsWithoutRef } from "react";

/** Mantine's own props plus the anchor's native ones, so handlers like onClick type-check. */
type MantineButtonLinkProps = ButtonProps &
  Omit<ComponentPropsWithoutRef<"a">, keyof ButtonProps | "href">;

const MantineButtonComponent = forwardRef<HTMLAnchorElement, MantineButtonLinkProps>(
  // oxlint-disable-next-line react/function-component-definition
  (props, ref) => <Button ref={ref} component="a" {...props} />,
);
MantineButtonComponent.displayName = "MantineButtonComponent";

const CreatedLinkComponent = createLink(MantineButtonComponent);

/**
 * Mantine Button that navigates with typed TanStack Router links. Use it, not `Button
 * component={TanStackAnchor}`, for any link drawn as a button: only text links underline on hover.
 */
// oxlint-disable-next-line react/function-component-definition
const TanStackButton: LinkComponent<typeof MantineButtonComponent> = (props) => (
  <CreatedLinkComponent preload="viewport" {...props} />
);

export default TanStackButton;
