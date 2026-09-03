import type { Icon } from "@tabler/icons-react";
import {
  IconBarcode,
  IconBell,
  IconBooks,
  IconBuildings,
  IconCashRegister,
  IconChartBar,
  IconDatabase,
  IconEdit,
  IconFileDollar,
  IconHeartHandshake,
  IconHourglassLow,
  IconMailFast,
  IconQrcode,
  IconReceipt,
  IconSchool,
  IconSend,
  IconShoppingCart,
  IconSignature,
  IconTimeline,
  IconUsers,
} from "@tabler/icons-react";
import type { LinkProps } from "@tanstack/react-router";

import { KASSE_DESCRIPTION, KASSE_TITLE } from "@/features/kasse/kasseDescription";

export interface AdminNavLink {
  label: string;
  description: string;
  to: LinkProps["to"];
  icon: Icon;
}

interface AdminNavSection {
  label: string;
  adminOnly?: boolean;
  links: AdminNavLink[];
  groups?: {
    label: string;
    icon: Icon;
    links: AdminNavLink[];
  }[];
}

export const ADMIN_NAV_SECTIONS = [
  {
    label: "Verktøy",
    links: [
      {
        label: KASSE_TITLE,
        description: KASSE_DESCRIPTION,
        to: "/admin/kasse",
        icon: IconCashRegister,
      },
      {
        label: "Handlekurv",
        description: "Gammel kasse i bl-admin",
        to: "/admin/handlekurv",
        icon: IconShoppingCart,
      },
      {
        label: "Ordreoversikt",
        description: "Finn en ordre og se levering og betaling",
        to: "/admin/ordreoversikt",
        icon: IconReceipt,
      },
      {
        label: "Venteliste",
        description: "Se hvem som venter på en bok",
        to: "/admin/venteliste",
        icon: IconHourglassLow,
      },
      {
        label: "Scanner",
        description: "Koble sammen unike IDer med ISBN",
        to: "/admin/scanner",
        icon: IconBarcode,
      },
      {
        label: "Overleveringer",
        description: "Følg opp overleveringer mellom elever",
        to: "/admin/overleveringer",
        icon: IconHeartHandshake,
      },
    ],
  },
  {
    label: "Admin",
    adminOnly: true,
    links: [
      {
        label: "Faktura",
        description: "Se og opprett fakturaer",
        to: "/admin/faktura",
        icon: IconFileDollar,
      },
    ],
    groups: [
      {
        label: "Kommunikasjon",
        icon: IconMailFast,
        links: [
          {
            label: "Påminnelser",
            description: "Send SMS eller e-post til elever med aktive bøker",
            to: "/admin/kommunikasjon/paminnelser",
            icon: IconBell,
          },
          {
            label: "Utsendelser",
            description: "Send SMS eller e-post til en liste med mottakere",
            to: "/admin/kommunikasjon/utsendelser",
            icon: IconSend,
          },
          {
            label: "Meldingslogg",
            description: "Se alle sendte meldinger og leveringsstatus i sanntid",
            to: "/admin/kommunikasjon/logg",
            icon: IconTimeline,
          },
        ],
      },
      {
        label: "Databaseverktøy",
        icon: IconDatabase,
        links: [
          {
            label: "Rapporter",
            description: "Hent ut tall om bøker, ordrer og betalinger",
            to: "/admin/database/rapporter",
            icon: IconChartBar,
          },
          {
            label: "Bøker",
            description: "Legg til og rediger bøker",
            to: "/admin/database/boker",
            icon: IconBooks,
          },
          {
            label: "Filialer",
            description: "Rediger filialer og åpningstider",
            to: "/admin/database/filialer",
            icon: IconSchool,
          },
          {
            label: "Brukere",
            description: "Se kundestatistikk, rydd i duplikater og administrer ansatte",
            to: "/admin/database/brukere",
            icon: IconUsers,
          },
          {
            label: "Signaturer",
            description: "Se de nyeste gyldige signaturene",
            to: "/admin/database/signaturer",
            icon: IconSignature,
          },
          {
            label: "Selskap",
            description: "Legg til og rediger selskap",
            to: "/admin/database/selskap",
            icon: IconBuildings,
          },
          {
            label: "Dynamisk innhold",
            description: "Rediger tekster og spørsmål på nettsiden",
            to: "/admin/database/dynamisk_innhold",
            icon: IconEdit,
          },
          {
            label: "Unike IDer",
            description: "Lag utskriftsklar PDF med unike IDer",
            to: "/admin/database/unik_id",
            icon: IconQrcode,
          },
        ],
      },
    ],
  },
] satisfies AdminNavSection[];

export function isAdminNavLinkActive(link: AdminNavLink, pathname: string) {
  return pathname === link.to || pathname.startsWith(`${link.to}/`);
}

export function visibleAdminNavSections(isAdmin: boolean) {
  return ADMIN_NAV_SECTIONS.filter((section) => !section.adminOnly || isAdmin);
}
