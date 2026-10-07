import { Text, UnstyledButton } from "@mantine/core";
import type { ReactNode } from "react";

import BookCover from "@/features/book-cover/BookCover";
import classes from "@/features/book-list/BookList.module.css";

/**
 * One book in a group: its cover and title, a line of what is particular to this copy, and the
 * one control for what can be done with it. The title opens the details, and its hit area covers
 * the whole row, so a tap anywhere outside the links and the control opens them too.
 */
export default function BookRow({
  title,
  isbn,
  meta,
  action,
  onOpen,
  muted = false,
  tone,
}: {
  title: string;
  isbn: string | null;
  /** The unique ID, the invoice, whom the book goes to: small pieces under the title. */
  meta?: ReactNode;
  /** The row's control; null when there is nothing to do with the book. */
  action?: ReactNode;
  /** Opens the details; left out for a book there are none to show for. */
  onOpen?: () => void;
  /** For books the customer no longer has. */
  muted?: boolean;
  /**
   * The book is part of an overlevering, coming from or going to another student: the row takes
   * the overlevering colour, so it is never handed out or taken back by mistake.
   */
  tone?: "peer";
}) {
  return (
    <div className={classes.row} data-muted={muted || undefined} data-tone={tone}>
      <div className={classes.cover}>
        <BookCover isbn={isbn} title={title} size="md" enlargeable={false} />
      </div>
      <div className={classes.body}>
        <div className={classes.text}>
          {onOpen ? (
            <UnstyledButton
              className={`${classes.open} ${classes.title}`}
              onClick={onOpen}
              aria-haspopup="dialog"
              title={title}
            >
              {title}
            </UnstyledButton>
          ) : (
            <Text fw={600} lh={1.3} className={classes.title}>
              {title}
            </Text>
          )}
          {meta && <div className={classes.meta}>{meta}</div>}
        </div>
        {action && <div className={classes.action}>{action}</div>}
      </div>
    </div>
  );
}
