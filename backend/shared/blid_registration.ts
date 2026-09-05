/**
 * DTOs for the Merking page, where an employee links freshly printed unique IDs (blids) to a book:
 * scan the book's ISBN once, then every blid sticker, then confirm the batch.
 */

/** The book a blid is linked to. */
export interface LinkedBook {
  itemId: string;
  title: string;
}

export type BlidRegistrationResponse =
  | {
      success: true;
      title: string;
      /** Blids linked by this batch. */
      added: number;
      /** Blids that were already linked to this very book; nothing was written for them. */
      skipped: number;
    }
  | {
      success: false;
      feedback: string;
      /** Blids linked to a different book than the scanned one, and which. */
      conflicts: { blid: string; linkedTo: LinkedBook }[];
    };
