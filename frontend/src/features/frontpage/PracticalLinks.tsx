import { Container } from "@mantine/core";

import classes from "@/features/frontpage/frontpage.module.css";
import TanStackAnchor from "@/shared/components/TanStackAnchor";

const TABS = [
  {
    to: "/info/branch",
    title: "Når er vi på skolen din?",
    text: "Standtidene legges ut et par uker før skolestart, og igjen før innlevering.",
    action: "Se våre åpningstider",
  },
  {
    to: "/info/faq",
    title: "Lurer du på noe?",
    text: "Betaling, henting, bytte og tilbakekjøp er forklart i spørsmål og svar.",
    action: "Les ofte stilte spørsmål",
  },
] as const;

export default function PracticalLinks() {
  return (
    <section className={classes.tabsSection} aria-label="Praktisk informasjon">
      <Container size="lg">
        <div className={classes.tabs}>
          {TABS.map((tab) => (
            <TanStackAnchor key={tab.to} to={tab.to} className={classes.tab} underline="never">
              <span className={classes.tabTitle}>{tab.title}</span>
              <span className={classes.tabText}>{tab.text}</span>
              <span className={classes.tabAction}>{tab.action}</span>
            </TanStackAnchor>
          ))}
        </div>
      </Container>
    </section>
  );
}
