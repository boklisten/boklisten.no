import { createFileRoute } from "@tanstack/react-router";

import ClosingCta from "@/features/frontpage/ClosingCta";
import classes from "@/features/frontpage/frontpage.module.css";
import Hero from "@/features/frontpage/Hero";
import PracticalLinks from "@/features/frontpage/PracticalLinks";
import SchoolNote from "@/features/frontpage/SchoolNote";
import Steps from "@/features/frontpage/Steps";
import PublicLayout from "@/features/PublicLayout";
import { seo } from "@/shared/utils/seo";

export const Route = createFileRoute("/")({
  head: () => ({
    ...seo({
      title: "Boklisten.no – pensumbøker til videregående og privatister",
      description:
        "Bestill pensumbøkene du trenger: velg skolen din og fagene du tar, så finner vi bøkene. Hent dem på stand ved skolen eller i posten, og lever eller få dem kjøpt tilbake når du er ferdig.",
    }),
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght,SOFT@9..144,600..700,50&display=swap",
      },
    ],
  }),
  component: Frontpage,
});

function Frontpage() {
  return (
    <PublicLayout padding={0} withBorder={false} footerSpacing={0}>
      <div className={classes.page}>
        <Hero />
        <Steps />
        <PracticalLinks />
        <ClosingCta />
        <SchoolNote />
      </div>
    </PublicLayout>
  );
}
