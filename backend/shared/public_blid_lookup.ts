/** A book someone holds right now: who, from where, and until when. */
export interface PublicBlidHandedOut {
  status: "handedOut";
  handoutBranch: string;
  handoutTime: string;
  deadline: string;
  title: string;
  isbn: string;
  name: string;
  email: string;
  phone: string;
}

/** A book Boklisten has registered but nobody holds: it belongs back at Boklisten. */
export interface PublicBlidNotHandedOut {
  status: "notHandedOut";
  title: string;
  isbn: string;
}

/** A unique ID Boklisten has never registered. */
export interface PublicBlidUnregistered {
  status: "unregistered";
}

export type PublicBlidLookupResult =
  | PublicBlidHandedOut
  | PublicBlidNotHandedOut
  | PublicBlidUnregistered;

/** The caller registered less than 24 hours ago and may not look up books yet. */
export interface PublicBlidLookupNotOpenYet {
  status: "notOpenYet";
  /** ISO timestamp for when the user may start looking up books. */
  opensAt: string;
}

/** The caller asked about too many IDs Boklisten has never seen and is shut out for a while. */
export interface PublicBlidLookupSuspended {
  status: "suspended";
  /** ISO timestamp for when the account may look up books again. */
  until: string;
}

export type PublicBlidLookupResponse =
  | PublicBlidLookupResult
  | PublicBlidLookupNotOpenYet
  | PublicBlidLookupSuspended;
