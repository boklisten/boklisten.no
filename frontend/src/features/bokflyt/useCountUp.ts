import { animate, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

/**
 * Counts from zero up to `target` once `active` turns true. With reduced
 * motion the target is shown straight away.
 */
export function useCountUp(target: number, active: boolean): number {
  const reduceMotion = useReducedMotion();
  const [value, setValue] = useState(() => (reduceMotion ? target : 0));

  useEffect(() => {
    if (!active || reduceMotion) {
      return undefined;
    }
    const controls = animate(0, target, {
      duration: 1.4,
      ease: "easeOut",
      onUpdate: (latest) => setValue(Math.round(latest)),
    });
    return () => controls.stop();
  }, [active, target, reduceMotion]);

  return reduceMotion ? target : value;
}
