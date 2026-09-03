import { Button, Container } from "@mantine/core";

import classes from "@/features/bokflyt/bokflyt.module.css";
import { scrollToSection } from "@/features/bokflyt/scrollToSection";
import { BOKFLYT_COLORS } from "@/features/bokflyt/theme";

export default function BokflytTopBar() {
  return (
    <header className={classes.topBar}>
      <Container size="lg" className={classes.topBarInner}>
        <a href="#topp" onClick={(event) => scrollToSection(event, "topp")}>
          <img
            src="/images/bokflyt.png"
            alt="Bokflyt, laget av Boklisten"
            className={classes.logo}
          />
        </a>
        <Button
          component="a"
          href="#kontakt"
          onClick={(event) => scrollToSection(event, "kontakt")}
          color={BOKFLYT_COLORS.deep}
          radius="xl"
        >
          Ta kontakt
        </Button>
      </Container>
    </header>
  );
}
