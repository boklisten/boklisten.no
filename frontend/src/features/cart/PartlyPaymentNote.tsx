import type { CartItemOption } from "@boklisten/backend/shared/cart_item";
import { IconCoins } from "@tabler/icons-react";
import { useId } from "react";

import classes from "@/features/cart/cart.module.css";
import { kroner } from "@/features/cart/cartLabels";
import { formatDeadline } from "@/shared/utils/deadline";

/**
 * What delbetaling means, told with the pupil's own cart: what they pay now, what is left by the
 * deadline, and the two ways to settle it. Selling the books back to us leads; keeping them and
 * paying the rest stays quiet beside it.
 */
export default function PartlyPaymentNote({ options }: { options: CartItemOption[] }) {
  const id = useId();
  const now = options.reduce((sum, option) => sum + option.price, 0);
  const later = options.reduce((sum, option) => sum + (option.payLater ?? 0), 0);
  // Lines with different deadlines have no one date to show
  const [deadline, ...otherDeadlines] = new Set(options.flatMap((option) => option.to ?? []));
  const deadlineLabel =
    deadline && otherDeadlines.length === 0
      ? formatDeadline(deadline, "D. MMMM YYYY")
      : "Ved fristen";

  return (
    <section className={classes.note} aria-labelledby={id}>
      <h2 className={classes.noteTitle} id={id}>
        Hva er delbetaling?
      </h2>
      <p className={classes.noteLead}>
        Du betaler bare en del av prisen nå, og restbeløpet innen fristen.
      </p>
      <ol className={classes.noteSteps}>
        <li className={classes.noteStep}>
          <span className={classes.noteWhen}>Nå</span>
          <span className={classes.noteAmount}>{kroner(now)}</span>
        </li>
        <li className={classes.noteStep} data-later>
          <span className={classes.noteWhen}>{deadlineLabel}</span>
          <span className={classes.noteAmount}>{kroner(later)}</span>
          <p className={classes.noteChoice}>Restbeløpet kan du gjøre opp på to måter:</p>
          <div className={classes.notePaths}>
            <div className={classes.notePath} data-featured>
              <p className={classes.notePathTitle}>
                <IconCoins size={20} aria-hidden />
                Selg bøkene tilbake til oss
              </p>
              <p className={classes.notePathPromise}>
                <span className={classes.noteMarked}>Vi dekker restbeløpet</span>
              </p>
              <p className={classes.noteText}>
                Vi kjøper vanligvis bøkene for like mye som restbeløpet eller mer, så du har
                ingenting igjen å betale.
              </p>
            </div>
            <div className={classes.notePath}>
              <p className={classes.notePathTitle}>Eller behold bøkene</p>
              <p className={classes.notePathPromise}>Du betaler selv</p>
              <p className={classes.noteText}>
                Da må du betale hele restbeløpet på{" "}
                <span className={classes.noteNoWrap}>{kroner(later)}</span>, på stand eller på nett.
              </p>
            </div>
          </div>
        </li>
      </ol>
    </section>
  );
}
