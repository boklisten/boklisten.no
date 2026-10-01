import classes from "@/features/info/InfoPagesNavigation.module.css";
import NavAnchor from "@/features/layout/nav/NavAnchor";
import { isNavLinkActive, usePathname } from "@/features/layout/nav/navigation";
import type { NavLink } from "@/features/layout/nav/navigation";

const PAGES: Pick<NavLink, "label" | "to" | "activeOn">[] = [
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
  const pathname = usePathname();
  return (
    <nav aria-label="Informasjonssider">
      <ul className={classes.list}>
        {PAGES.map((page) => (
          <li key={page.to}>
            <NavAnchor
              to={page.to}
              active={isNavLinkActive(page, pathname)}
              className={classes.chip}
            >
              {page.label}
            </NavAnchor>
          </li>
        ))}
      </ul>
    </nav>
  );
}
