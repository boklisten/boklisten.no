import type { CartItem } from "@boklisten/backend/shared/cart_item";
import { Box } from "@mantine/core";

import { useBookCoverImage } from "@/features/book-cover/bookCoverQuery";
import classes from "@/features/order/order.module.css";

const MAX_COVERS = 4;

/** Cover colours for books whose picture is missing; the title picks one, so a book keeps its colour. */
const COVER_COLORS = ["#26768f", "#3f6f5a", "#8a4b3b", "#4b5a8a", "#7a5c2e"];

function coverColor(title: string): string {
  let hash = 0;
  for (const char of title) {
    hash = (hash * 31 + (char.codePointAt(0) ?? 0)) % COVER_COLORS.length;
  }
  return COVER_COLORS[hash] ?? COVER_COLORS[0]!;
}

/** The subject's books as a small hand of covers, so one book and five read differently at a glance. */
export default function SubjectBookFan({ books }: { books: CartItem[] }) {
  const shown = books.slice(0, MAX_COVERS);
  return (
    <Box
      component="span"
      className={classes.fan}
      style={{ "--fan-count": shown.length }}
      aria-hidden
    >
      {shown.map((book, index) => (
        <Cover key={book.id} book={book} index={index} count={shown.length} />
      ))}
    </Box>
  );
}

/** The book's picture, or a small plain cover with its title while there is none. */
function Cover({ book, index, count }: { book: CartItem; index: number; count: number }) {
  const { src, onError } = useBookCoverImage(book.isbn);
  return (
    <Box
      component="span"
      className={classes.fanCover}
      style={{ "--fan-index": index, "--fan-tilt": `${(index - (count - 1) / 2) * 7}deg` }}
    >
      {src === null ? (
        <Box
          component="span"
          className={classes.fanPlaceholder}
          style={{ "--cover-color": coverColor(book.title) }}
        >
          <span className={classes.fanTitle}>{book.title}</span>
        </Box>
      ) : (
        <img src={src} alt="" onError={onError} />
      )}
    </Box>
  );
}
