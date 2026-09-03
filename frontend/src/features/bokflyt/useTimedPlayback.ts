import { useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";

export interface PlaybackStep<T> {
  /** Milliseconds after playback starts. */
  at: number;
  value: T;
}

/** Fires every step on time; returns a function that stops the playback. */
function schedule<T>(steps: PlaybackStep<T>[], setValue: Dispatch<SetStateAction<T>>) {
  const timers = steps.map((step) => setTimeout(() => setValue(step.value), step.at));
  return () => {
    for (const timer of timers) {
      clearTimeout(timer);
    }
  };
}

/**
 * Steps a value through a fixed timeline once `active` turns true, for the
 * figures that play out a short scene. `steps` must be a stable reference.
 */
export function useTimedPlayback<T>(initial: T, steps: PlaybackStep<T>[], active: boolean) {
  const [value, setValue] = useState(initial);
  const cancel = useRef<() => void>(() => {});

  useEffect(() => {
    if (!active) {
      return undefined;
    }
    cancel.current = schedule(steps, setValue);
    return () => cancel.current();
  }, [active, steps]);

  const replay = () => {
    cancel.current();
    setValue(initial);
    cancel.current = schedule(steps, setValue);
  };

  return { value, replay };
}
