import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";

import { rowState } from "@/features/merking/registrationRows";
import type {
  BatchReceipt,
  ScannedBlidRow,
  SelectedBook,
} from "@/features/merking/registrationRows";
import { BLID_SEARCH_QUERY_KEY } from "@/features/kasse/SearchSpotlight";
import type { ScanNotice } from "@/shared/components/scanner/ScannerPanel";
import useApiClient from "@/shared/hooks/useApiClient";
import { GENERIC_ERROR_TEXT } from "@/shared/utils/constants";
import { showErrorNotification } from "@/shared/utils/notifications";
import { describeRejectedScan, determineScanCodeType } from "@/shared/utils/scanCodes";

export interface BlidRegistrationSession {
  book: SelectedBook | null;
  rows: ScannedBlidRow[];
  receipt: BatchReceipt | null;
  isRegistering: boolean;
  /** Takes an ISBN or a blid. Resolves to a notice when the code led nowhere. */
  submitCode: (code: string) => Promise<ScanNotice | undefined>;
  removeRow: (blid: string) => void;
  clearBook: () => void;
  register: () => void;
  dismissReceipt: () => void;
}

/**
 * One batch on the Merking page: the book, the stickers scanned for it, and the receipt of the
 * last confirmation. Every input (physical scanner, manual entry, later the camera) goes through
 * `submitCode`, so a code behaves the same however it arrived.
 */
export default function useBlidRegistrationSession(): BlidRegistrationSession {
  const { api, client } = useApiClient();
  const queryClient = useQueryClient();
  const [book, setBook] = useState<SelectedBook | null>(null);
  const [rows, setRows] = useState<ScannedBlidRow[]>([]);
  const [receipt, setReceipt] = useState<BatchReceipt | null>(null);
  // The physical scanner captures submitCode when it mounts and fires between renders, so every
  // change to the list goes through commitRows and the duplicate check reads the ref, not state.
  const rowsRef = useRef(rows);
  const commitRows = (next: ScannedBlidRow[]) => {
    rowsRef.current = next;
    setRows(next);
  };
  const updateRow = (blid: string, check: ScannedBlidRow["check"]) =>
    commitRows(rowsRef.current.map((row) => (row.blid === blid ? { ...row, check } : row)));

  const selectBook = async (isbn: string): Promise<ScanNotice | undefined> => {
    let item;
    try {
      item = await client.api.items.getByIsbn({ params: { isbn } });
    } catch {
      return { message: GENERIC_ERROR_TEXT };
    }
    if (item === null) {
      return {
        title: "Ukjent ISBN",
        message: `Fant ingen bok med ISBN ${isbn}. Sjekk at du skannet riktig strekkode.`,
      };
    }
    setReceipt(null);
    setBook({ id: item.id, title: item.title, isbn });
    return undefined;
  };

  const addBlid = async (blid: string): Promise<ScanNotice | undefined> => {
    if (rowsRef.current.some((row) => row.blid === blid)) {
      return { title: "Allerede skannet", message: "Den unike IDen ligger allerede i listen." };
    }
    setReceipt(null);
    commitRows([{ blid, check: { status: "checking" } }, ...rowsRef.current]);
    try {
      const linkedTo = await client.api.blidRegistration.lookupLink({ params: { blid } });
      updateRow(blid, { status: "checked", linkedTo });
    } catch {
      updateRow(blid, { status: "failed" });
    }
    return undefined;
  };

  const submitCode = async (code: string): Promise<ScanNotice | undefined> => {
    const type = determineScanCodeType(code);
    if (type === "isbn") {
      return selectBook(code);
    }
    if (type === "blid") {
      return addBlid(code);
    }
    return describeRejectedScan(type, ["isbn", "blid"]);
  };

  const registerMutation = useMutation({
    mutationFn: (body: { isbn: string; blids: string[] }) =>
      client.api.blidRegistration.register({ body }),
    onSuccess: (result) => {
      if (!result.success) {
        showErrorNotification(result.feedback);
        // Someone linked these stickers since they were scanned: show the rows as they are now.
        for (const conflict of result.conflicts) {
          updateRow(conflict.blid, { status: "checked", linkedTo: conflict.linkedTo });
        }
        return;
      }
      setReceipt({ title: result.title, added: result.added, skipped: result.skipped });
      commitRows([]);
      // Boksøk and the search dropdown may hold these blids as unknown.
      for (const key of [api.blidSearch.lookup.pathKey(), BLID_SEARCH_QUERY_KEY]) {
        void queryClient.invalidateQueries({ queryKey: key });
      }
    },
    onError: () => showErrorNotification(GENERIC_ERROR_TEXT),
  });

  const register = () => {
    if (book === null) {
      return;
    }
    const blids = rows
      .filter((row) => ["free", "linked-here"].includes(rowState(row, book)))
      .map((row) => row.blid);
    registerMutation.mutate({ isbn: book.isbn, blids });
  };

  return {
    book,
    rows,
    receipt,
    isRegistering: registerMutation.isPending,
    submitCode,
    removeRow: (blid) => commitRows(rowsRef.current.filter((row) => row.blid !== blid)),
    clearBook: () => setBook(null),
    register,
    dismissReceipt: () => setReceipt(null),
  };
}
