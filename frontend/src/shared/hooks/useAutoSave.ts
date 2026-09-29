import { useRef } from "react";

import { PLEASE_TRY_AGAIN_TEXT } from "@/shared/utils/constants";
import { errorMessage } from "@/shared/utils/errorMessage";
import { showErrorNotification, showSuccessNotification } from "@/shared/utils/notifications";

/**
 * Auto-save for forms on existing entities, the pattern every admin form follows: there is no
 * "Lagre" button, text fields save on blur and controls on change. Saves go through one queue so
 * a burst of changes reaches the server in order, a body equal to the last saved one is skipped,
 * one toast with a fixed id reports each save, and a failed save is forgotten so the next change
 * or blur retries it.
 *
 * The caller keeps the form's default values as a snapshot from when the editor opened (never the
 * live query), so the refetch after a save cannot reset what the admin is typing.
 */
export default function useAutoSave<Body>({
  initialBody,
  persist,
  notifications,
  onSaved,
}: {
  /** What the server holds when the editor opens; saving the same thing again is a no-op. */
  initialBody: Body;
  persist: (body: Body) => Promise<unknown>;
  notifications: {
    /** Fixed id, so repeated saves do not stack toasts. */
    id: string;
    saved: string;
    failed: string;
  };
  /** After a successful save, e.g. to invalidate the query the editor was opened from. */
  onSaved?: () => void;
}) {
  const lastSavedBody = useRef(JSON.stringify(initialBody));
  const queue = useRef(Promise.resolve());

  async function run(body: Body) {
    try {
      await persist(body);
      showSuccessNotification({ id: notifications.id, message: notifications.saved });
      onSaved?.();
    } catch (error) {
      // Forget the failed body, so the next change or blur tries again.
      lastSavedBody.current = "";
      showErrorNotification({
        title: notifications.failed,
        message: errorMessage(error, PLEASE_TRY_AGAIN_TEXT),
      });
    }
  }

  function save(body: Body) {
    const serializedBody = JSON.stringify(body);
    if (serializedBody === lastSavedBody.current) {
      return;
    }
    lastSavedBody.current = serializedBody;
    queue.current = queue.current.then(() => run(body));
  }

  return { save };
}
