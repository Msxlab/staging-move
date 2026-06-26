"use client";

import { useEffect, useRef, useState, type ComponentType, type CSSProperties } from "react";
import type { LottieRefCurrentProps } from "lottie-react";

/**
 * DOSSIER LOTTIE STAGE — plays the score-selected segment of a parameter's
 * Lottie character (After-Effects-authored, see public/lottie/dossier/README).
 *
 * SSR/test-safe by design: `lottie-react` is imported lazily inside an effect
 * (never at module top), so importing this component does not pull the player
 * into the server/test bundle. Until an asset is wired (`data` null), it renders
 * a graceful empty stage — so the card works before the Lottie files exist.
 * Honours prefers-reduced-motion (holds the segment's first frame).
 */

type LottieProps = {
  lottieRef?: React.Ref<LottieRefCurrentProps>;
  animationData: unknown;
  autoplay?: boolean;
  loop?: boolean;
  style?: CSSProperties;
  "aria-hidden"?: boolean;
};

export function DossierLottieStage({
  data = null,
  segment,
  height = 84,
}: {
  data?: unknown | null;
  segment?: [number, number];
  height?: number;
}) {
  const [Lottie, setLottie] = useState<ComponentType<LottieProps> | null>(null);
  const ref = useRef<LottieRefCurrentProps>(null);

  useEffect(() => {
    if (!data) return;
    let alive = true;
    void import("lottie-react").then((mod) => {
      if (alive) setLottie(() => mod.default as unknown as ComponentType<LottieProps>);
    });
    return () => {
      alive = false;
    };
  }, [data]);

  useEffect(() => {
    if (!data || !ref.current || !segment) return;
    const reduce =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) ref.current.goToAndStop(segment[0], true);
    else ref.current.playSegments(segment, true);
  }, [Lottie, data, segment]);

  if (!data || !Lottie) {
    return <div aria-hidden="true" style={{ height }} />;
  }
  return (
    <Lottie lottieRef={ref} animationData={data} autoplay={false} loop style={{ height }} aria-hidden />
  );
}
