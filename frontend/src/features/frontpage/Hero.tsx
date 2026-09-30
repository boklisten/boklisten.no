import { Button, Container, NavLink, Stack, Text, Title } from "@mantine/core";
import { IconBook, IconExternalLink } from "@tabler/icons-react";
import { Activity } from "react";

import BookFan from "@/features/frontpage/BookFan";
import classes from "@/features/frontpage/frontpage.module.css";
import ShowCustomerIdButton from "@/shared/components/ShowCustomerIdButton";
import TanStackAnchor from "@/shared/components/TanStackAnchor";
import useAuth from "@/shared/hooks/useAuth";

export default function Hero() {
  const { isLoggedIn, isEmployee, userId } = useAuth();

  return (
    <section className={classes.hero}>
      <Container size="lg">
        <div className={classes.heroGrid}>
          <Stack gap="lg">
            <Title order={1} className={`${classes.display} ${classes.heroTitle}`}>
              <span className={classes.mark}>Alltid riktig bok.</span>
            </Title>
            <Text className={`${classes.lead} ${classes.heroLead}`}>
              Velg skolen din og fagene du tar, så finner vi bøkene du trenger. Hent dem på stand
              ved skolen, eller få dem i posten.
            </Text>

            <div className={classes.actions}>
              <Button
                component={TanStackAnchor}
                to="/bestilling"
                size="lg"
                radius="xl"
                variant="white"
              >
                Bestill bøker
              </Button>
              <Activity mode={isLoggedIn ? "visible" : "hidden"}>
                <Button
                  component={TanStackAnchor}
                  to="/items"
                  size="lg"
                  radius="xl"
                  variant="outline"
                  color="white"
                  leftSection={<IconBook />}
                >
                  Dine bøker
                </Button>
                {userId && (
                  <ShowCustomerIdButton
                    customerId={userId}
                    size="lg"
                    radius="xl"
                    variant="subtle"
                    color="white"
                  />
                )}
              </Activity>
              <Activity mode={!isLoggedIn ? "visible" : "hidden"}>
                <Button
                  component={TanStackAnchor}
                  to="/auth/login"
                  size="lg"
                  radius="xl"
                  variant="outline"
                  color="white"
                >
                  Logg inn
                </Button>
              </Activity>
            </div>

            <Text className={`${classes.note} ${classes.heroNote}`}>
              Åpent kjøp i 14 dager. Privatister kan dele opp betalingen.
            </Text>

            <Activity mode={isEmployee ? "visible" : "hidden"}>
              <NavLink
                component={TanStackAnchor}
                to="/admin"
                className={classes.employee}
                label="Gå til bl-admin"
                description="Her kan du søke opp kunder, samle inn og dele ut bøker."
                leftSection={<IconExternalLink />}
                active
                color="orange"
                underline="never"
              />
            </Activity>
          </Stack>

          <BookFan />
        </div>
      </Container>
    </section>
  );
}
