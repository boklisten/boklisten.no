import { Anchor, Container, Text, Title } from "@mantine/core";

import BookFlowDiagram from "@/features/bokflyt/BookFlowDiagram";
import classes from "@/features/frontpage/frontpage.module.css";
import TanStackAnchor from "@/shared/components/TanStackAnchor";
import { CONTACT_INFO } from "@/shared/utils/constants";

/** A quiet note for the other audience: schools buy through agreements, not through the shop. */
export default function SchoolNote() {
  return (
    <section className={classes.schools} aria-labelledby="for-skoler">
      <Container size="lg">
        <div className={classes.schoolsGrid}>
          <div className={classes.schoolsText}>
            <Title order={2} id="for-skoler" className={`${classes.display} ${classes.smallTitle}`}>
              Skoleeier eller i administrasjonen på en skole?
            </Title>
            <Text className={classes.body}>
              Vi inngår avtaler med skoler om utlån og salg av lærebøker. Send oss en e-post på{" "}
              <Anchor href={`mailto:${CONTACT_INFO.email}`} fw={600}>
                {CONTACT_INFO.email}
              </Anchor>
              , så tar vi en prat. Med konseptet{" "}
              <TanStackAnchor to="/bokflyt" fw={600}>
                Bokflyt
              </TanStackAnchor>{" "}
              går bøkene rett fra elev til elev.
            </Text>
          </div>
          <div className={classes.schoolsFigure}>
            <BookFlowDiagram />
          </div>
        </div>
      </Container>
    </section>
  );
}
