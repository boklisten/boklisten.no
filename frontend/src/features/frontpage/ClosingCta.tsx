import { Button, Container, Title } from "@mantine/core";
import { Activity } from "react";

import classes from "@/features/frontpage/frontpage.module.css";
import TanStackAnchor from "@/shared/components/TanStackAnchor";
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
              <Button component={TanStackAnchor} to="/bestilling" size="lg" radius="xl">
                Bestill bøker
              </Button>
              <Button
                component={TanStackAnchor}
                to="/items"
                size="lg"
                radius="xl"
                variant="outline"
              >
                Se mine bøker
              </Button>
            </Activity>
            <Activity mode={!isLoggedIn ? "visible" : "hidden"}>
              <Button component={TanStackAnchor} to="/auth/register" size="lg" radius="xl">
                Registrer deg
              </Button>
              <Button
                component={TanStackAnchor}
                to="/auth/login"
                size="lg"
                radius="xl"
                variant="outline"
              >
                Logg inn
              </Button>
            </Activity>
          </div>
        </div>
      </Container>
    </section>
  );
}
