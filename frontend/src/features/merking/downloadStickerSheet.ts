import { apiClient } from "@/shared/utils/apiClient";
import { downloadBlob } from "@/shared/utils/downloadBlob";
import { API_URL } from "@/shared/utils/env";
import { exportFilename } from "@/shared/utils/exportFilename";

async function fetchStickerSheet(): Promise<Blob> {
  const response = await fetch(API_URL + apiClient.urlFor("unique_ids.pdf"), {
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error(`Could not fetch the sticker sheet (${response.status})`);
  }
  return response.blob();
}

/** A sheet fetched ahead of time, so the download starts at once. Each one is downloaded once. */
let prepared: Promise<Blob> | null = null;

/**
 * Starts fetching a sheet unless one is already on its way. A failed fetch is forgotten so the
 * next call tries again; the failure itself surfaces when the sheet is downloaded.
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
 * Hands a fresh sheet of stickers to the browser as a PDF. The sheet prepared earlier is used and
 * the next one is fetched right away, so downloading again gives new ids just as quickly.
 */
export default async function downloadStickerSheet(): Promise<void> {
  const sheet = prepareStickerSheet();
  prepared = null;
  const blob = await sheet;
  prepareStickerSheet().catch(() => undefined);
  downloadBlob(exportFilename("unike-id-er", "pdf"), blob);
}
