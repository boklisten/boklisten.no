import { Affix, Transition } from "@mantine/core";
import type { ReactNode } from "react";

import classes from "@/shared/components/FloatingActionBar.module.css";

/**
 * A bar docked above the bottom of the viewport (and the phone tab bar) that says what the visitor
 * has gathered, marked with the navigation's highlighter, and offers the one next step. It sits on
 * the page's own column and leaves room for itself at the end of the page so the last row can
 * still be reached.
 */
export default function FloatingActionBar({
  visible,
  summary,
  detail,
  children,
}: {
  visible: boolean;
  summary: string;
  detail?: string;
  children: ReactNode;
}) {
  return (
    <Transition mounted={visible} transition="slide-up" duration={200}>
      {(style) => (
        <>
          <div className={classes.spacer} aria-hidden />
          <Affix
            position={{
              bottom: "calc(var(--tabbar-height, 0px) + 1rem)",
              left: 0,
              right: 0,
            }}
            zIndex="var(--mantine-z-index-app)"
            withinPortal={false}
            style={style}
          >
            <div className={classes.column}>
              <div className={classes.bar}>
                <div className={classes.text}>
                  <span className={classes.summary}>{summary}</span>
                  {detail && <span className={classes.detail}>{detail}</span>}
                </div>
                <div className={classes.action}>{children}</div>
              </div>
            </div>
          </Affix>
        </>
      )}
    </Transition>
  );
}
