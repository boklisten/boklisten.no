import { MESSAGE_CHANNELS } from "@boklisten/backend/shared/message-log";
import type { MessageChannel } from "@boklisten/backend/shared/message-log";

import { stringParam } from "@/shared/utils/searchParams";

const MESSAGE_LOG_TABS = ["logg", "statistikk"] as const;
export type MessageLogTab = (typeof MESSAGE_LOG_TABS)[number];

/** Longest recipient search the API accepts. */
const SEARCH_MAX_LENGTH = 100;

/**
 * Everything that narrows the log lives in the URL, so a view can be linked and survives a
 * reload. Names are prefixed where a bare word is used by another route.
 */
export interface MessageLogSearchParams {
  loggFane?: MessageLogTab;
  kanal?: MessageChannel;
  bareFeil?: true;
  loggSok?: string;
  /** The sendout the feed is narrowed to. */
  utsendelse?: number;
}

/**
 * Anything can be pasted into the URL, so every part is checked before the page trusts it. The
 * router lays the result over the raw search, so a rejected value is returned as `undefined`
 * rather than left out; the URL drops undefined parts, so it never grows empty defaults.
 */
export function validateMessageLogSearch(search: Record<string, unknown>): MessageLogSearchParams {
  const tab = MESSAGE_LOG_TABS.find((candidate) => candidate === search["loggFane"]);
  const text = stringParam(search["loggSok"]).trim().slice(0, SEARCH_MAX_LENGTH);
  const sendoutId = search["utsendelse"];
  return {
    loggFane: tab === "logg" ? undefined : tab,
    kanal: MESSAGE_CHANNELS.find((candidate) => candidate === search["kanal"]),
    bareFeil: search["bareFeil"] === true ? true : undefined,
    loggSok: text === "" ? undefined : text,
    utsendelse:
      typeof sendoutId === "number" && Number.isInteger(sendoutId) && sendoutId > 0
        ? sendoutId
        : undefined,
  };
}
