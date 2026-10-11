import { apiClient } from "@/shared/utils/apiClient";
import { API_URL } from "@/shared/utils/env";

/** The previous sheet's iframe and blob, kept until the next sheet replaces them (see below). */
let current: { frame: HTMLIFrameElement; url: string } | null = null;

/** Hidden but not display: none, which would keep the browser from printing it. */
const HIDDEN_FRAME_STYLE = {
  position: "fixed",
  right: "0",
  bottom: "0",
  width: "0",
  height: "0",
  border: "0",
  visibility: "hidden",
} satisfies Partial<CSSStyleDeclaration>;

/** Resolves once the frame has loaded its document and the print dialog has been asked for. */
function printWhenLoaded(frame: HTMLIFrameElement): Promise<void> {
  return new Promise((resolve, reject) => {
    frame.addEventListener("load", () => {
      try {
        frame.contentWindow?.focus();
        frame.contentWindow?.print();
        resolve();
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
    frame.addEventListener("error", () => reject(new Error("Could not load the sticker sheet")));
  });
}

async function fetchStickerSheet(): Promise<Blob> {
  const response = await fetch(API_URL + apiClient.urlFor("unique_ids.pdf"), {
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error(`Could not fetch the sticker sheet (${response.status})`);
  }
  return response.blob();
}

/** A sheet fetched ahead of time, so the print dialog opens at once. Each one prints once. */
let prepared: Promise<Blob> | null = null;

/**
 * Starts fetching a sheet unless one is already on its way. A failed fetch is forgotten so the
 * next call tries again; the failure itself surfaces when the sheet is printed.
 */
export function prepareStickerSheet(): Promise<Blob> {
  if (prepared === null) {
    const sheet = fetchStickerSheet();
    prepared = sheet;
    sheet.catch(() => {
      if (prepared === sheet) {
        prepared = null;
      }
    });
  }
  return prepared;
}

/**
 * Opens the browser's print dialog on a fresh sheet of stickers without saving a file: the PDF,
 * fetched with the session cookie into a blob, is same-origin, so it can be shown in a hidden
 * iframe and printed from there. The sheet prepared earlier is used and the next one is fetched
 * right away, so printing again gives new ids just as quickly. The iframe stays until the next
 * sheet replaces it, as the dialog may still be reading it.
 */
export default async function printStickerSheet(): Promise<void> {
  const sheet = prepareStickerSheet();
  prepared = null;
  const blob = await sheet;
  prepareStickerSheet().catch(() => undefined);
  const url = URL.createObjectURL(blob);

  if (current !== null) {
    current.frame.remove();
    URL.revokeObjectURL(current.url);
  }
  const frame = document.createElement("iframe");
  frame.title = "Utskrift av unike IDer";
  frame.setAttribute("aria-hidden", "true");
  Object.assign(frame.style, HIDDEN_FRAME_STYLE);
  current = { frame, url };

  const printed = printWhenLoaded(frame);
  frame.src = url;
  document.body.append(frame);
  await printed;
}
