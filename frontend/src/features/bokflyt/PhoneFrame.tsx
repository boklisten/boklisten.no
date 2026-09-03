import type { ReactNode } from "react";

import classes from "@/features/bokflyt/bokflyt.module.css";

/**
 * A phone-shaped frame for showing real product components with mock data.
 * The content is inert: it is an illustration, so nothing inside can be
 * clicked, focused or read as page content.
 */
export default function PhoneFrame({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className={classes.phone} role="img" aria-label={label}>
      <div className={classes.phoneScreen}>
        <div className={classes.phoneNotch} />
        <div className={`${classes.phoneBody} ${classes.noInteraction}`} inert>
          {children}
        </div>
        <div className={classes.phoneFade} />
      </div>
    </div>
  );
}
