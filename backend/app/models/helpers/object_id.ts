import { ObjectId } from "bson";

/**
 * Primary keys of tables migrated from MongoDB keep the 24-character hex ObjectId format, so ids
 * transferred from Mongo and ids generated here for new rows live in the same key space without
 * colliding: 4-byte timestamp, 5-byte process random, 3-byte counter. Ids therefore also stay
 * sortable by creation time.
 *
 * A migrated model opts in like this (mirroring `app/models/message.ts`):
 *
 *   export default class Item extends ItemSchema {
 *     static override selfAssignPrimaryKey = true;
 *
 *     @beforeCreate()
 *     static assignId(item: Item) {
 *       assignObjectId(item);
 *     }
 *   }
 */
export function newObjectId(): string {
  return new ObjectId().toHexString();
}

export function isObjectIdHex(value: string): boolean {
  return /^[0-9a-fA-F]{24}$/.test(value);
}

/** `@beforeCreate` body for models with a self-assigned ObjectId primary key. */
export function assignObjectId(row: { id: string }): void {
  row.id ||= newObjectId();
}
