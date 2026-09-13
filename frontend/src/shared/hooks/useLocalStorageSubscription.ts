import { useSyncExternalStore } from "react";

function readLocalStorage(key: string) {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

export default function useLocalStorageSubscription(key: string) {
  return useSyncExternalStore(
    (callback) => {
      const onStorage = (event: StorageEvent) => {
        if (event.key === key) {
          callback();
        }
      };
      window.addEventListener("storage", onStorage);
      return () => window.removeEventListener("storage", onStorage);
    },
    () => readLocalStorage(key),
    () => null,
  );
}
