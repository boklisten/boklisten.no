import { useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";

export interface PlaybackStep<T> {
  /** Milliseconds after playback starts. */
  at: number;
  value: T;
}

/** How long the final scene stays on screen before the loop starts over. */
const HOLD_LAST_SCENE_MS = 3000;

/**
 * Plays every step on time, holds the last scene, then starts over from
 * `initial`; returns a function that stops the loop.
 */
function loop<T>(initial: T, steps: PlaybackStep<T>[], setValue: Dispatch<SetStateAction<T>>) {
  let timers: ReturnType<typeof setTimeout>[] = [];
  const clear = () => {
    for (const timer of timers) {
      clearTimeout(timer);
    }
  };

  const runCycle = () => {
    setValue(initial);
    const lastAt = Math.max(0, ...steps.map((step) => step.at));
    timers = [
      ...steps.map((step) => setTimeout(() => setValue(step.value), step.at)),
      setTimeout(runCycle, lastAt + HOLD_LAST_SCENE_MS),
    ];
  };

  runCycle();
  return clear;
}

/**
 * Steps a value through a fixed timeline on repeat while `active` is true,
 * for the figures that play out a short scene. `steps` must be a stable
 * reference. Turning `active` off stops the loop; turning it back on starts
 * again from the beginning.
 */
export function useTimedPlayback<T>(initial: T, steps: PlaybackStep<T>[], active: boolean) {
  const [value, setValue] = useState(initial);

  useEffect(() => {
    if (!active) {
      return undefined;
    }
    return loop(initial, steps, setValue);
  }, [active, initial, steps]);

  return value;
}
