import { Box } from "@mantine/core";

import classes from "@/features/book-cover/BookCoverArt.module.css";
import { useBookCoverImage } from "@/features/book-cover/bookCoverQuery";
import type { Isbn } from "@/features/book-cover/bookCoverQuery";

/** Cover colours for books whose picture is missing; the title picks one, so a book keeps its colour. */
const COVER_COLORS = ["#26768f", "#3f6f5a", "#8a4b3b", "#4b5a8a", "#7a5c2e"];

function coverColor(title: string): string {
  let hash = 0;
  for (const char of title) {
    hash = (hash * 31 + (char.codePointAt(0) ?? 0)) % COVER_COLORS.length;
  }
  return COVER_COLORS[hash] ?? COVER_COLORS[0]!;
}

/**
 * The plain cover with the title that stands in for a missing picture. Fills its positioned
 * parent; the parent sets --cover-title-size.
 */
export function BookCoverPlaceholder({ title }: { title: string }) {
  return (
    <span className={classes.art}>
      <Box
        component="span"
        className={classes.placeholder}
        style={{ "--cover-color": coverColor(title) }}
      >
        <span className={classes.title}>{title}</span>
      </Box>
    </span>
  );
}

/**
 * The book's picture, or a small plain cover with its title while there is none. Fills its
 * positioned parent, which decides the size and any tilt.
 */
export default function BookCoverArt({ title, isbn }: { title: string; isbn: Isbn }) {
  const { src, onError } = useBookCoverImage(isbn);
  if (src === null) {
    return <BookCoverPlaceholder title={title} />;
  }
  return (
    <span className={classes.art}>
      <img src={src} alt="" onError={onError} />
    </span>
  );
}
