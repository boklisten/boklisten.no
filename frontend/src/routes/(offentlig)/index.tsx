import { createFileRoute } from "@tanstack/react-router";

import { mockCoverSrc } from "@/features/bokflyt/mockBooks";
import { FAN_BOOKS } from "@/features/frontpage/BookFan";
import ClosingCta from "@/features/frontpage/ClosingCta";
import classes from "@/features/frontpage/frontpage.module.css";
import Hero from "@/features/frontpage/Hero";
import PracticalLinks from "@/features/frontpage/PracticalLinks";
import SchoolNote from "@/features/frontpage/SchoolNote";
import Steps from "@/features/frontpage/Steps";
import { seo } from "@/shared/utils/seo";

export const Route = createFileRoute("/(offentlig)/")({
  head: () => ({
    ...seo({
      title: "Boklisten.no – pensumbøker til videregående og privatister",
      description:
        "Bestill pensumbøkene du trenger: velg skolen din og fagene du tar, så finner vi bøkene. Hent dem på stand ved skolen eller i posten, og lever eller få dem kjøpt tilbake når du er ferdig.",
    }),
    // The hero's cover fan is only drawn from `md` up; fetch its pictures ahead of the first paint there.
    links: FAN_BOOKS.map((book) => ({
      rel: "preload",
      as: "image",
      href: mockCoverSrc(book),
      media: "(min-width: 62em)",
    })),
  }),
  component: Frontpage,
});

function Frontpage() {
  return (
    <div className={classes.page}>
      <Hero />
      <Steps />
      <PracticalLinks />
      <ClosingCta />
      <SchoolNote />
    </div>
  );
}
