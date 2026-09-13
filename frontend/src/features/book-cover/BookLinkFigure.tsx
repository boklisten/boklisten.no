import { Stack, Text, ThemeIcon } from "@mantine/core";
import { IconLink } from "@tabler/icons-react";

import BookCover from "@/features/book-cover/BookCover";
import classes from "@/features/book-cover/BookLinkFigure.module.css";

/** A unique ID connected to a book, as a picture: the ID, a line, the book's cover with its title and ISBN. */
export default function BookLinkFigure({
  blid,
  isbn,
  title,
}: {
  blid: string;
  isbn: string | number;
  title: string;
}) {
  return (
    <div className={classes.figure}>
      <Stack gap={4} align="center" className={classes.side}>
        <Text ff="monospace" fw={700} size="sm" lh={1.2} ta="center" className={classes.wrap}>
          {blid}
        </Text>
        <Text size="xs" c="dimmed">
          Unik ID
        </Text>
      </Stack>
      <div className={classes.connector}>
        <span className={classes.line} />
        <ThemeIcon size="sm" radius="xl">
          <IconLink size={14} aria-hidden />
        </ThemeIcon>
        <span className={classes.line} />
      </div>
      <Stack gap={4} align="center" className={`${classes.side} ${classes.bookSide}`}>
        <BookCover isbn={isbn} title={title} size="lg" />
        <Text size="sm" fw={600} ta="center" lineClamp={3} className={classes.wrap}>
          {title}
        </Text>
        <Text size="xs" c="dimmed">
          ISBN {isbn}
        </Text>
      </Stack>
    </div>
  );
}
