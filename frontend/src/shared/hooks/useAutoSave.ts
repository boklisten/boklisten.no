import { useQueryClient } from "@tanstack/react-query";
import type { QueryKey } from "@tanstack/react-query";
import { useEffect, useEffectEvent, useId, useRef, useState } from "react";

import { PLEASE_TRY_AGAIN_TEXT } from "@/shared/utils/constants";
import { errorMessage } from "@/shared/utils/errorMessage";
import { showErrorNotification, showSuccessNotification } from "@/shared/utils/notifications";

/** The parts of a form's api that auto-save uses, without TanStack Form's many generics. */
interface AutoSavedForm<Values> {
  state: { values: Values };
  validate: (cause: "submit") => unknown;
  handleSubmit: () => Promise<void>;
}

/** The toast every auto-saved change shows. `id` replaces the previous toast instead of stacking another. */
function notifySaved(id: string) {
  showSuccessNotification({ id, message: "Endringene er lagret" });
}

function notifySaveFailed(error: unknown) {
  showErrorNotification({
    title: "Klarte ikke lagre endringene",
    message: errorMessage(error, PLEASE_TRY_AGAIN_TEXT),
  });
}

/**
 * Form options that make an edit form save itself, with no "Lagre" button:
 *
 * ```tsx
 * const form = useAppForm(
 *   useAutoSave({
 *     defaultValues: valuesOf(branch),
 *     persist: (values) => apiClient.api.branches.update({ params: { branchId }, body: values }),
 *     invalidates: [api.branches.index.pathKey()],
 *   }),
 * );
 * ```
 *
 * A field saves once it is done: text fields on blur, and controls where every change is a final
 * choice (switches, selects, chips, sliders on release) right away, since they report a blur with
 * each change (see `commitValue`). Anything typed but not yet blurred is saved when the form
 * unmounts, e.g. a modal closed with Escape.
 *
 * Each save goes through `handleSubmit`, so it runs every validator and is skipped while one
 * fails; show the errors with `<form.ErrorSummary autoSave />`. Saves reach the server in order,
 * unchanged values are not sent again, and a failed save is retried by the next change.
 */
export default function useAutoSave<Values>({
  defaultValues,
  persist,
  invalidates = [],
  onSaved,
}: {
  /**
   * The entity as form values. Only the first render's values are used, so the refetch after a
   * save cannot reset what the user is typing; key the form by the entity to edit another one.
   */
  defaultValues: Values;
  /** Sends the values, mapped to the request body where they differ. */
  persist: (values: Values) => Promise<unknown>;
  /** Refetched once the saves in flight are done, whether they succeeded or not. */
  invalidates?: QueryKey[];
  /** After each successful save. */
  onSaved?: () => void;
}) {
  const queryClient = useQueryClient();
  const toastId = useId();
  // oxlint-disable-next-line react/hook-use-state -- the snapshot is never replaced
  const [initial] = useState(() => ({
    values: defaultValues,
    json: JSON.stringify(defaultValues),
  }));
  const lastSaved = useRef(initial.json);
  const queue = useRef(Promise.resolve());
  const savesInFlight = useRef(0);
  const mountedForm = useRef<AutoSavedForm<Values>>(null);

  async function save(form: AutoSavedForm<Values>) {
    if (!isUnsaved(form.state.values)) {
      return;
    }
    // handleSubmit gives up on field errors before it runs the form-level validators, so errors
    // those left on fields the user never touched would block every later save; rerun them first.
    await form.validate("submit");
    await form.handleSubmit();
  }

  function isUnsaved(values: Values) {
    return JSON.stringify(values) !== lastSaved.current;
  }

  function enqueue(values: Values) {
    if (!isUnsaved(values)) {
      return;
    }
    lastSaved.current = JSON.stringify(values);
    savesInFlight.current += 1;
    queue.current = queue.current.then(() => run(values));
  }

  async function run(values: Values) {
    try {
      await persist(values);
      notifySaved(toastId);
      onSaved?.();
    } catch (error) {
      // Forget the failed values, so the next change tries again.
      lastSaved.current = "";
      notifySaveFailed(error);
    } finally {
      savesInFlight.current -= 1;
      if (savesInFlight.current === 0) {
        for (const queryKey of invalidates) {
          void queryClient.invalidateQueries({ queryKey });
        }
      }
    }
  }

  const saveOnUnmount = useEffectEvent(() => {
    if (mountedForm.current) {
      void save(mountedForm.current);
    }
  });
  useEffect(() => () => saveOnUnmount(), []);

  return {
    defaultValues: initial.values,
    onSubmit: ({ value }: { value: Values }) => enqueue(value),
    listeners: {
      onMount: ({ formApi }: { formApi: AutoSavedForm<Values> }) => {
        mountedForm.current = formApi;
      },
      onBlur: ({ formApi }: { formApi: AutoSavedForm<Values> }) => void save(formApi),
    },
  };
}
