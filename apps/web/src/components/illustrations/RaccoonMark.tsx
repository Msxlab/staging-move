import * as React from "react";
import { cn } from "@/lib/utils";

export type RaccoonMarkMood = "calm" | "alert" | "happy" | "thinking" | "approved";

type RaccoonMarkProps = {
  size?: number;
  height?: number;
  mood?: RaccoonMarkMood;
  className?: string;
};

export function RaccoonMark({ size = 140, height = size, mood = "calm", className }: RaccoonMarkProps) {
  const markSize = Math.min(size, height);
  const offsetX = (size - markSize) / 2;
  const offsetY = (height - markSize) / 2;
  const scale = markSize / 100;
  const squint = mood === "thinking";
  const happy = mood === "happy" || mood === "approved";
  const alert = mood === "alert";
  const sparkle = mood === "approved";
  const eyeR = squint ? 6 : 8;
  const pupilR = squint ? 3.5 : 5;

  return (
    <svg
      width={size}
      height={height}
      viewBox={`0 0 ${size} ${height}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      role="presentation"
      focusable="false"
      className={cn("inline-block", className)}
    >
      <g transform={`translate(${offsetX} ${offsetY}) scale(${scale})`}>
        <path d="M18 40 L12 8 L34 24Z" fill="#8C9AB2" />
        <path d="M19 37 L15 14 L30 24Z" fill="#C4A090" opacity="0.9" />
        <path d="M82 40 L88 8 L66 24Z" fill="#8C9AB2" />
        <path d="M81 37 L85 14 L70 24Z" fill="#C4A090" opacity="0.9" />
        <ellipse cx="50" cy="58" rx="36" ry="31" fill="#8C9AB2" />
        <ellipse cx="50" cy="45" rx="24" ry="14" fill="#B8C2D0" opacity="0.42" />
        <ellipse cx="18" cy="66" rx="12" ry="9" fill="#C0CAD8" opacity="0.4" />
        <ellipse cx="82" cy="66" rx="12" ry="9" fill="#C0CAD8" opacity="0.4" />
        <ellipse cx="33" cy="51" rx="16" ry="13" fill="#0C1525" transform="rotate(-6 33 51)" />
        <ellipse cx="67" cy="51" rx="16" ry="13" fill="#0C1525" transform="rotate(6 67 51)" />
        <rect x="44" y="46" width="12" height="10" rx="5" fill="#0C1525" />
        <path d="M20 43 Q50 36 80 43" stroke="#0C1525" strokeWidth="8" strokeLinecap="round" fill="none" />
        {alert ? (
          <>
            <path d="M21 37 Q33 31 43 35" stroke="#0C1525" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.7" />
            <path d="M79 37 Q67 31 57 35" stroke="#0C1525" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.7" />
          </>
        ) : null}
        <circle cx="33" cy="51" r={eyeR} fill="hsl(var(--primary))" />
        <circle cx="33" cy="51" r={pupilR} fill="#04080F" />
        <circle cx="35.5" cy="48.5" r="1.8" fill="#FFFFFF" opacity="0.75" />
        <circle cx="67" cy="51" r={eyeR} fill="hsl(var(--primary))" />
        <circle cx="67" cy="51" r={pupilR} fill="#04080F" />
        <circle cx="69.5" cy="48.5" r="1.8" fill="#FFFFFF" opacity="0.75" />
        {squint ? (
          <>
            <line x1="25" y1="51" x2="41" y2="51" stroke="#0C1525" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
            <line x1="59" y1="51" x2="75" y2="51" stroke="#0C1525" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
          </>
        ) : null}
        {sparkle ? (
          <>
            <path d="M24 37 L25.5 33 L27 37 L25.5 41Z" fill="hsl(var(--primary))" opacity="0.9" />
            <path d="M73 37 L74.5 33 L76 37 L74.5 41Z" fill="hsl(var(--primary))" opacity="0.9" />
          </>
        ) : null}
        <path d="M46 66 L50 72 L54 66 Q50 63 46 66Z" fill="#0C1525" />
        {happy ? <path d="M43 75 Q50 81 57 75" stroke="#0C1525" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.45" /> : null}
        <circle cx="17" cy="67" r="1.3" fill="#0C1525" opacity="0.26" />
        <circle cx="23" cy="67" r="1.3" fill="#0C1525" opacity="0.26" />
        <circle cx="30" cy="67" r="1.3" fill="#0C1525" opacity="0.26" />
        <circle cx="70" cy="67" r="1.3" fill="#0C1525" opacity="0.26" />
        <circle cx="77" cy="67" r="1.3" fill="#0C1525" opacity="0.26" />
        <circle cx="83" cy="67" r="1.3" fill="#0C1525" opacity="0.26" />
        <ellipse cx="50" cy="76" rx="17" ry="10" fill="#C8D0DC" opacity="0.3" />
      </g>
    </svg>
  );
}

export default RaccoonMark;
