import { useSyncExternalStore } from "react";

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
    () => localStorage.getItem(key) ?? "",
    () => null,
  );
}
