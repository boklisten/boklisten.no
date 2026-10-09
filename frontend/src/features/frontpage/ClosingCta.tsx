import { Container, Title } from "@mantine/core";
import { Activity } from "react";

import classes from "@/features/frontpage/frontpage.module.css";
import TanStackButton from "@/shared/components/TanStackButton";
import useAuth from "@/shared/hooks/useAuth";

export default function ClosingCta() {
  const { isLoggedIn } = useAuth();

  return (
    <section className={`${classes.section} ${classes.closing}`}>
      <Container size="lg">
        <div className={classes.closingInner}>
          <Title order={2} className={`${classes.display} ${classes.sectionTitle}`}>
            Hva venter du på?
          </Title>
          <div className={classes.actions}>
            <Activity mode={isLoggedIn ? "visible" : "hidden"}>
              <TanStackButton to="/bestilling" size="lg" radius="xl">
                Bestill bøker
              </TanStackButton>
              <TanStackButton to="/items" size="lg" radius="xl" variant="outline">
                Se mine bøker
              </TanStackButton>
            </Activity>
            <Activity mode={!isLoggedIn ? "visible" : "hidden"}>
              <TanStackButton to="/bestilling" size="lg" radius="xl">
                Bestill bøker
              </TanStackButton>
              <TanStackButton to="/auth/login" size="lg" radius="xl" variant="outline">
                Logg inn
              </TanStackButton>
            </Activity>
          </div>
        </div>
      </Container>
    </section>
  );
}
