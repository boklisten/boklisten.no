import { Box } from "@mantine/core";

import { MOCK_BOOKS, mockCoverSrc } from "@/features/bokflyt/mockBooks";
import classes from "@/features/merking/stickerGuide.module.css";
import ScanCodeIllustration, {
  BLID_LABEL_IMAGE,
} from "@/shared/components/scanner/ScanCodeIllustration";

/**
 * Where the two stickers of an id go, played on a book: the cover swings open and the first
 * sticker lands bottom right on the left page of the first spread; the book closes and turns
 * round, and the second lands at the bottom of the back, right beside the ISBN barcode.
 *
 * Cover and sticker are pictures the site already ships: a cover from the Bokflyt set and the
 * example label the scan prompts show, so the sticker is exactly what comes out of the printer.
 */
export default function BookStickerAnimation() {
  return (
    <Box
      className={classes.stage}
      w={{ base: "100%", sm: 300 }}
      h={{ base: 260, sm: "auto" }}
      mih={260}
      aria-hidden="true"
    >
      <div className={classes.bookScene}>
        <div className={classes.book}>
          <div className={classes.page}>
            <span className={classes.pageLine} style={{ width: "72%" }} />
            <span className={classes.pageLine} style={{ width: "54%" }} />
            <span className={classes.pageLine} style={{ width: "64%" }} />
            <span className={classes.pageLine} style={{ width: "40%" }} />
          </div>
          <div className={classes.coverPivot}>
            <div className={classes.coverFront}>
              <img src={mockCoverSrc(MOCK_BOOKS.kraft1)} alt="" className={classes.coverImage} />
            </div>
            <div className={classes.coverInside}>
              <img src={BLID_LABEL_IMAGE} alt="" className={classes.insideSticker} />
            </div>
          </div>
          <div className={classes.back}>
            <div className={classes.isbn}>
              <ScanCodeIllustration type="isbn" scale={0.35} />
            </div>
            <img src={BLID_LABEL_IMAGE} alt="" className={classes.backSticker} />
          </div>
          <div className={classes.spine} />
          <div className={classes.edge} />
        </div>
      </div>
    </Box>
  );
}
