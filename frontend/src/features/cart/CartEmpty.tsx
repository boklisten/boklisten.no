import { Box } from "@mantine/core";

import classes from "@/features/cart/cart.module.css";
import TanStackButton from "@/shared/components/TanStackButton";

/** Nothing in the cart yet: say so, and point to the two places books come from. */
export default function CartEmpty() {
  return (
    <div className={classes.empty}>
      <div className={classes.emptyFan} aria-hidden>
        {[0, 1, 2].map((index) => (
          <Box
            key={index}
            component="span"
            className={classes.emptyCover}
            style={{ "--fan-index": index, "--fan-tilt": `${(index - 1) * 9}deg` }}
          />
        ))}
      </div>
      <h1 className={classes.emptyTitle}>Handlekurven er tom</h1>
      <p className={classes.emptyText}>
        Velg skolen og fagene dine for å få boklisten, eller forleng og kjøp ut bøker du allerede
        har under Dine bøker.
      </p>
      <div className={classes.emptyActions}>
        <TanStackButton to="/bestilling" size="md" radius="xl">
          Bestill bøker
        </TanStackButton>
        <TanStackButton to="/items" size="md" radius="xl" variant="outline">
          Dine bøker
        </TanStackButton>
      </div>
    </div>
  );
}
