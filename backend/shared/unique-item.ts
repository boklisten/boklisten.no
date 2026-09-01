import type { BlDocument } from "#shared/bl-document";

export interface UniqueItem extends BlDocument {
  blid: string; // a 12 character long unique identification
  item: string; // id of item
  title: string; // the title of the item
}
