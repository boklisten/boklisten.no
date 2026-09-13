import { Modal, UnstyledButton } from "@mantine/core";
import { IconBook2 } from "@tabler/icons-react";
import { useState } from "react";

import classes from "@/features/book-cover/BookCover.module.css";
import { useBookCoverUrl } from "@/features/book-cover/bookCoverQuery";
import type { Isbn } from "@/features/book-cover/bookCoverQuery";

// Nasjonalbiblioteket serves covers at roughly 130–250 px tall; enlarging further only blurs.
const MAX_ENLARGEMENT = 2;

const ICON_SIZE = { sm: 18, md: 24, lg: 32, xl: 40 } as const;

export type BookCoverSize = keyof typeof ICON_SIZE;

/**
 * The front cover of a book in a fixed portrait frame. The frame shows a book icon from the first
 * render and keeps it whenever there is no cover to show, so nothing waits on the lookup and
 * nothing shifts when it lands. A shown cover opens larger on click unless `enlargeable` is off.
 */
export default function BookCover({
  isbn,
  title,
  size = "md",
  enlargeable = true,
}: {
  isbn: Isbn;
  title?: string;
  /** "sm" in a list row, "md" beside a heading, "lg" in a link figure, "xl" as a card's subject. */
  size?: BookCoverSize;
  /** Off inside rows that are themselves clickable. */
  enlargeable?: boolean;
}) {
  const coverUrl = useBookCoverUrl(isbn);
  const [brokenUrl, setBrokenUrl] = useState<string | null>(null);
  const [enlarged, setEnlarged] = useState(false);
  const showCover = coverUrl !== null && coverUrl !== brokenUrl;

  const content = showCover ? (
    <img src={coverUrl} alt="" className={classes.image} onError={() => setBrokenUrl(coverUrl)} />
  ) : (
    <IconBook2 size={ICON_SIZE[size]} />
  );
  if (!showCover || !enlargeable) {
    return (
      <div className={classes.frame} data-size={size} aria-hidden>
        {content}
      </div>
    );
  }

  const bookName = title ? `«${title}»` : "boka";
  return (
    <>
      <UnstyledButton
        className={classes.frame}
        data-size={size}
        aria-label={`Vis omslaget til ${bookName} større`}
        onClick={() => setEnlarged(true)}
      >
        {content}
      </UnstyledButton>
      <Modal
        opened={enlarged}
        onClose={() => setEnlarged(false)}
        title={title ?? "Omslag"}
        size="sm"
        centered
      >
        <EnlargedCover src={coverUrl} alt={`Omslaget til ${bookName}`} />
      </Modal>
    </>
  );
}

function EnlargedCover({ src, alt }: { src: string; alt: string }) {
  const [naturalWidth, setNaturalWidth] = useState<number | null>(null);
  return (
    <img
      src={src}
      alt={alt}
      className={classes.enlarged}
      style={naturalWidth === null ? undefined : { maxWidth: naturalWidth * MAX_ENLARGEMENT }}
      onLoad={(event) => setNaturalWidth(event.currentTarget.naturalWidth)}
    />
  );
}
