import { Box, Button, Container } from "@mantine/core";

import classes from "@/features/bokflyt/bokflyt.module.css";
import { scrollToSection } from "@/features/bokflyt/scrollToSection";
import { BOKFLYT_COLORS } from "@/features/bokflyt/theme";

export default function BokflytTopBar() {
  return (
    <header className={classes.topBar}>
      <Container size="lg" className={classes.topBarInner}>
        <a href="#topp" onClick={(event) => scrollToSection(event, "topp")}>
          {/* Both copies have a clear ground so the blurred bar shows through; the dark one has
              lightened type. bokflyt.png keeps its white ground for share previews. */}
          <Box
            component="img"
            src="/images/bokflyt-light.png"
            alt="Bokflyt, laget av Boklisten"
            className={classes.logo}
            darkHidden
          />
          <Box
            component="img"
            src="/images/bokflyt-dark.png"
            alt="Bokflyt, laget av Boklisten"
            className={classes.logo}
            lightHidden
          />
        </a>
        <Button
          component="a"
          href="#kontakt"
          onClick={(event) => scrollToSection(event, "kontakt")}
          color={BOKFLYT_COLORS.deepFill}
          radius="xl"
        >
          Ta kontakt
        </Button>
      </Container>
    </header>
  );
}
