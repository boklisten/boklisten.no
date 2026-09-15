import { Stack, Title } from "@mantine/core";
import { IconCircleCheck } from "@tabler/icons-react";
import { AnimatePresence, motion } from "motion/react";

import { useBookCoverImage } from "@/features/book-cover/bookCoverQuery";
import BlidLabel from "@/features/bokflyt/BlidLabel";
import classes from "@/features/bokflyt/bokflyt.module.css";
import { emilReceiving, HANDOVER_BOOKS } from "@/features/bokflyt/mockMatches";
import PhoneFrame from "@/features/bokflyt/PhoneFrame";
import { BOKFLYT_COLORS } from "@/features/bokflyt/theme";
import MatchScannerContent from "@/shared/components/matches/MatchScannerContent";

const COVER_COLORS = [BOKFLYT_COLORS.deep, "#3f6f5a", "#8a4b3b"];

/**
 * The book under the camera: its real cover when Nasjonalbiblioteket has one, otherwise a
 * plain coloured cover with the title. The sticker sits on top either way.
 */
function BookCover({ index }: { index: number }) {
  const copy = HANDOVER_BOOKS[index]!;
  const { src, onError } = useBookCoverImage(copy.book.isbn);
  return (
    <motion.div
      key={copy.id}
      className={classes.bookCover}
      style={{ background: COVER_COLORS[index] }}
      initial={{ opacity: 0, y: 24, rotate: -4 }}
      animate={{ opacity: 1, y: 0, rotate: -4 }}
      exit={{ opacity: 0, y: -24, rotate: -4 }}
      transition={{ duration: 0.35 }}
    >
      {src === null ? (
        <span className={classes.bookCoverTitle}>{copy.book.title}</span>
      ) : (
        <img src={src} alt="" className={classes.bookCoverImage} onError={onError} />
      )}
      <BlidLabel id={copy.blid} />
    </motion.div>
  );
}

/**
 * The receiver's phone: the real scanner's layout with a drawn camera view.
 * `booksReceived` books have been scanned; the next one is in the viewfinder.
 */
export default function ScanFigure({
  booksReceived,
  animated,
}: {
  booksReceived: number;
  animated: boolean;
}) {
  const allReceived = booksReceived >= HANDOVER_BOOKS.length;
  const coverIndex = Math.min(booksReceived, HANDOVER_BOOKS.length - 1);

  return (
    <PhoneFrame label="Espen skanner bøkene han mottar fra Ronja, og hver bok blir registrert">
      <Stack gap="sm">
        <Title order={4}>Skann bøker</Title>
        <div className={classes.viewfinder}>
          <AnimatePresence mode="wait" initial={false}>
            <BookCover key={coverIndex} index={coverIndex} />
          </AnimatePresence>
          <div className={classes.scanFrame} />
          {animated && !allReceived && (
            <motion.div
              className={classes.scanLine}
              animate={{ top: ["12%", "88%", "12%"] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
            />
          )}
          {animated && booksReceived > 0 && (
            <motion.div
              key={`flash-${booksReceived}`}
              className={classes.scanFlash}
              initial={{ opacity: 0.7 }}
              animate={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
            />
          )}
          {allReceived && (
            <motion.div
              className={classes.scanDone}
              initial={animated ? { opacity: 0 } : false}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              <IconCircleCheck size={56} stroke={1.6} />
            </motion.div>
          )}
          {booksReceived > 0 && (
            <motion.div
              key={`toast-${booksReceived}`}
              className={classes.scanToast}
              initial={animated ? { opacity: 0, y: 10 } : false}
              animate={{ opacity: 1, y: 0 }}
            >
              <IconCircleCheck size={16} />
              Boken har blitt registrert!
            </motion.div>
          )}
        </div>
        <MatchScannerContent obligations={emilReceiving(booksReceived)} />
      </Stack>
    </PhoneFrame>
  );
}
