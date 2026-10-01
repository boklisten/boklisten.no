import type { ReactNode } from "react";

import type { FileRouteTypes } from "@/routeTree.gen";
import TanStackAnchor from "@/shared/components/TanStackAnchor";

/**
 * A link in the navigation, marked current by the navigation's own rule (`isNavLinkActive`) as
 * `data-active` for the styles and `aria-current` for assistive tech. The router would add
 * `aria-current` itself to every link whose route is a prefix of the page (the home on every page);
 * `exact` keeps it to the page itself, which the navigation's rule always agrees with.
 */
export default function NavAnchor({
  to,
  active,
  className,
  onClick,
  children,
  ...data
}: {
  to: FileRouteTypes["to"];
  active: boolean;
  className: string;
  onClick?: () => void;
  children: ReactNode;
  "aria-label"?: string;
  "data-key"?: string;
}) {
  return (
    <TanStackAnchor
      to={to}
      activeOptions={{ exact: true }}
      className={className}
      underline="never"
      data-active={active || undefined}
      aria-current={active ? "page" : undefined}
      onClick={onClick}
      {...data}
    >
      {children}
    </TanStackAnchor>
  );
}
