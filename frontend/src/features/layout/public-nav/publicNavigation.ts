import {
  IconBook,
  IconClock,
  IconHeartHandshake,
  IconHelpCircle,
  IconHome,
  IconInfoCircle,
  IconMail,
  IconReceipt,
  IconSearch,
  IconShoppingCart,
  IconUserEdit,
} from "@tabler/icons-react";

import type { NavLink } from "@/features/layout/nav/navigation";

export interface PublicNavLink extends NavLink {
  loggedInOnly?: true;
}

/*
 * Every public destination in one place, so the tab bar, the desktop bar and the menu sheet agree
 * on names, icons and who sees what. The pages under /info are one entry in the bars; the info
 * section has its own sub-navigation on the page.
 */
const HOME: PublicNavLink = { label: "Hjem", to: "/", icon: IconHome, exact: true };
const ORDER: PublicNavLink = { label: "Bestill bøker", to: "/bestilling", icon: IconShoppingCart };
const MY_BOOKS: PublicNavLink = {
  label: "Dine bøker",
  to: "/items",
  icon: IconBook,
  loggedInOnly: true,
};
const INFO: PublicNavLink = {
  label: "Informasjon",
  to: "/info/general",
  icon: IconInfoCircle,
  activeOn: "/info",
};

export const USER_SETTINGS: PublicNavLink = {
  label: "Brukerinnstillinger",
  to: "/user-settings",
  icon: IconUserEdit,
  loggedInOnly: true,
};

/** What the visitor does with books: the first group in the menu. */
export const BOOK_LINKS: PublicNavLink[] = [
  ORDER,
  MY_BOOKS,
  { label: "Ordrehistorikk", to: "/order-history", icon: IconReceipt, loggedInOnly: true },
  { label: "Overleveringer", to: "/overleveringer", icon: IconHeartHandshake, loggedInOnly: true },
  {
    label: "Boksøk",
    to: "/sjekk",
    icon: IconSearch,
    loggedInOnly: true,
    hint: "Finn ut hvem som er ansvarlig for en bok.",
  },
];

/** The information pages, as the menu lists them. */
export const INFO_LINKS: PublicNavLink[] = [
  { label: "Generell informasjon", to: "/info/general", icon: IconInfoCircle },
  { label: "Spørsmål og svar", to: "/info/faq", icon: IconHelpCircle },
  { label: "Skoler og åpningstider", to: "/info/branch", icon: IconClock },
  { label: "Kontakt oss", to: "/info/contact", icon: IconMail },
];

/** The cart, reached from the pill in the top bar while there is something in it. */
export const CART_PATH = "/handlekurv";

/**
 * The three destinations that are always one tap away, on the phone tab bar and top right on
 * desktop; the menu holds the rest. The third is the visitor's books once logged in.
 */
export function primaryLinks(isLoggedIn: boolean): PublicNavLink[] {
  return [HOME, ORDER, isLoggedIn ? MY_BOOKS : INFO];
}
