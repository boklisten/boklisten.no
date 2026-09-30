import type { CartItem } from "@boklisten/backend/shared/cart_item";
import { Box } from "@mantine/core";

import BookCoverArt from "@/features/book-cover/BookCoverArt";
import classes from "@/features/order/order.module.css";

const MAX_COVERS = 4;

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
        <Box
          key={book.id}
          component="span"
          className={classes.fanCover}
          style={{
            "--fan-index": index,
            "--fan-tilt": `${(index - (shown.length - 1) / 2) * 7}deg`,
          }}
        >
          <BookCoverArt title={book.title} isbn={book.isbn} />
        </Box>
      ))}
    </Box>
  );
}
