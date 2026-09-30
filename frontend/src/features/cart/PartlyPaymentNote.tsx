import { Collapse } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconChevronDown } from "@tabler/icons-react";
import { useId } from "react";

import classes from "@/features/cart/cart.module.css";

/** What delbetaling means, folded away until the pupil asks. */
export default function PartlyPaymentNote() {
  const [opened, { toggle }] = useDisclosure(false);
  const id = useId();
  return (
    <div className={classes.note}>
      <button
        type="button"
        className={classes.noteToggle}
        aria-expanded={opened}
        aria-controls={id}
        onClick={toggle}
      >
        Hva er delbetaling?
        <IconChevronDown size={18} aria-hidden />
      </button>
      <Collapse expanded={opened} id={id}>
        <div className={classes.noteBody}>
          <p>
            Du betaler restbeløpet på det oppgitte tidspunktet. Restbeløpet betales ved vår
            bokinnkjøpsstand på din skole på slutten av semesteret eller på nett. Mange privatister
            ønsker å selge bøkene sine på slutten av semesteret og Boklisten kjøper inn bøker fra
            privatister.
          </p>
          <p>
            Hvis du selger boken din til Boklisten vil vi vanligvis betale det samme som restbeløpet
            eller mer.
          </p>
        </div>
      </Collapse>
    </div>
  );
}
