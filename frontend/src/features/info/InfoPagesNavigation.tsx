import { useLocation } from "@tanstack/react-router";

import classes from "@/features/info/InfoPagesNavigation.module.css";
import { isActive } from "@/features/layout/public-nav/publicNavigation";
import type { PublicNavLink } from "@/features/layout/public-nav/publicNavigation";
import TanStackAnchor from "@/shared/components/TanStackAnchor";

const PAGES: Pick<PublicNavLink, "label" | "to" | "activeOn">[] = [
  { label: "Generell informasjon", to: "/info/general" },
  { label: "Spørsmål og svar", to: "/info/faq" },
  { label: "For VGS-elever", to: "/info/pupils" },
  { label: "Skoler og åpningstider", to: "/info/branch" },
  { label: "Avtaler og betingelser", to: "/info/policies/conditions", activeOn: "/info/policies" },
  { label: "Om oss", to: "/info/about" },
  { label: "For skolekunder", to: "/info/companies" },
  { label: "Innkjøpsliste", to: "/info/buyback" },
  { label: "Kontakt oss", to: "/info/contact" },
];

export default function InfoPagesNavigation() {
  const pathname = useLocation({ select: (location) => location.pathname });
  return (
    <nav aria-label="Informasjonssider">
      <ul className={classes.list}>
        {PAGES.map((page) => {
          const active = isActive(page, pathname);
          return (
            <li key={page.to}>
              <TanStackAnchor
                to={page.to}
                className={classes.chip}
                underline="never"
                data-active={active || undefined}
                aria-current={active ? "page" : undefined}
              >
                {page.label}
              </TanStackAnchor>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
