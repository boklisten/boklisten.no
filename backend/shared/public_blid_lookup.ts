/** A book someone holds right now: who, from where, and until when. */
export interface PublicBlidHandedOut {
  status: "handedOut";
  handoutBranch: string;
  handoutTime: string;
  /** `YYYY-MM-DD`. */
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
interface PublicBlidUnregistered {
  status: "unregistered";
}

export type PublicBlidLookupResult =
  | PublicBlidHandedOut
  | PublicBlidNotHandedOut
  | PublicBlidUnregistered;

/** The caller has never logged in with Vipps, which looking up books requires. */
interface PublicBlidLookupVippsRequired {
  status: "vippsRequired";
}

/** The caller asked about too many IDs Boklisten has never seen and is shut out for a while. */
export interface PublicBlidLookupSuspended {
  status: "suspended";
  /** ISO timestamp for when the account may look up books again. */
  until: string;
}

export type PublicBlidLookupResponse =
  | PublicBlidLookupResult
  | PublicBlidLookupVippsRequired
  | PublicBlidLookupSuspended;
