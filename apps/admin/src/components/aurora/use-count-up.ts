"use client";

import { useEffect, useState } from "react";

/**
 * Eases `to` in from 0 over `dur` ms (ease-out quint). Honors
 * prefers-reduced-motion by jumping straight to the end value.
 */
export function useCountUp(to: number, dur = 900): number {
  const [v, setV] = useState(0);

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setV(to);
      return;
    }
    let raf = 0;
    let start = 0;
    const step = (t: number) => {
      if (!start) start = t;
      const p = Math.min(1, (t - start) / dur);
      const e = 1 - Math.pow(1 - p, 5);
      setV(to * e);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to, dur]);

  return v;
}
