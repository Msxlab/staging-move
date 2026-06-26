"use client";

import { cn } from "@/lib/utils";
import { Undo2 } from "lucide-react";
import { useEffect, useState, type FC, type ReactNode } from "react";
import { AnimatePresence, motion, MotionConfig } from "motion/react";

/**
 * TimedUndoAction — undo-with-countdown for destructive LocateFlow actions.
 *
 * Repurposed from the watermelon "Delete Account / Cancel Delete" countdown into
 * a generic timed-undo: after deleting a service, address, provider, or reminder
 * we show a few-second "Undo" window before the delete commits. Tapping the
 * primary action arms the countdown; tapping again (or the window elapsing)
 * resolves it.
 *
 * Re-themed onto the sapphire (no-gold) tokens: the armed/destructive state uses
 * `bg-destructive` + `text-destructive-foreground`, the undo affordance uses
 * `text-foreground`, and there are no hardcoded red-500 / neutral hexes or
 * dark:#hex overrides — theming flows through the .light / .dark CSS vars.
 *
 * The original relied on `react-use-measure` (not installed) to animate width.
 * This version uses motion's built-in `layout` so width animates with the
 * content and no extra dependency is required.
 */

export interface TimedUndoActionProps {
  /** Seconds before the delete commits. */
  initialSeconds?: number;
  /** Resting label, e.g. "Delete address". */
  deleteLabel?: string;
  /** Armed label shown during the countdown, e.g. "Undo delete". */
  undoLabel?: string;
  icon?: ReactNode;
  /** Fired when the countdown elapses without an undo (delete commits). */
  onCommit?: () => void;
  /** Fired when the user cancels during the window. */
  onUndo?: () => void;
}

export const TimedUndoAction: FC<TimedUndoActionProps> = ({
  initialSeconds = 5,
  deleteLabel = "Delete address",
  undoLabel = "Undo delete",
  icon,
  onCommit,
  onUndo,
}) => {
  const [isArmed, setIsArmed] = useState(false);
  const [countDown, setCountDown] = useState(initialSeconds);

  const handleClick = () => {
    setIsArmed((prev) => {
      const next = !prev;
      if (next) {
        setCountDown(initialSeconds);
      } else {
        onUndo?.();
      }
      return next;
    });
  };

  useEffect(() => {
    if (!isArmed) return;

    const interval = setInterval(() => {
      setCountDown((prev) => {
        if (prev < 1) {
          setIsArmed(false);
          onCommit?.();
          return initialSeconds;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [isArmed, initialSeconds, onCommit]);

  return (
    <div className="flex w-full items-center justify-center font-sans">
      <div className="flex flex-col items-center justify-center will-change-transform">
        <MotionConfig
          transition={{
            type: "spring",
            stiffness: 250,
            damping: 22,
          }}
        >
          <motion.button
            type="button"
            layout
            aria-label={isArmed ? undoLabel : deleteLabel}
            className={cn(
              "relative flex cursor-pointer items-center justify-start overflow-hidden rounded-full transition-colors duration-300",
              isArmed
                ? "bg-destructive/10"
                : "bg-destructive"
            )}
            onClick={handleClick}
          >
            <motion.div
              layout
              className={cn(
                "flex items-center justify-center gap-2 px-6 py-3",
                isArmed && "px-3"
              )}
            >
              <AnimatePresence mode="popLayout">
                {isArmed && (
                  <motion.div
                    className="rounded-full bg-destructive p-2"
                    initial={{ opacity: 0, filter: "blur(2px)" }}
                    animate={{ opacity: 1, filter: "blur(0px)" }}
                    exit={{ opacity: 0, filter: "blur(2px)" }}
                  >
                    {icon ?? (
                      <Undo2 className="size-5 text-destructive-foreground" />
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex items-center justify-center gap-2">
                <AnimatedText
                  text={isArmed ? undoLabel : deleteLabel}
                  className={cn(
                    "z-10 text-lg",
                    isArmed ? "text-destructive" : "text-destructive-foreground"
                  )}
                />
              </div>

              <AnimatePresence mode="popLayout">
                {isArmed && (
                  <motion.div
                    className="flex items-center justify-center rounded-full bg-destructive px-3 py-1 tabular-nums text-destructive-foreground"
                    initial={{ opacity: 0, filter: "blur(2px)" }}
                    animate={{ opacity: 1, filter: "blur(0px)" }}
                    exit={{ opacity: 0, filter: "blur(2px)" }}
                  >
                    <AnimatePresence mode="popLayout">
                      <motion.span
                        key={countDown}
                        className="text-lg"
                        initial={{
                          opacity: 0,
                          y: -20,
                          filter: "blur(2px)",
                          scale: 0.5,
                        }}
                        animate={{
                          opacity: 1,
                          y: 0,
                          filter: "blur(0px)",
                          scale: 1,
                        }}
                        exit={{
                          opacity: 0,
                          y: 20,
                          filter: "blur(2px)",
                          scale: 0.5,
                        }}
                        transition={{
                          type: "spring",
                          stiffness: 240,
                          damping: 20,
                          mass: 1,
                        }}
                      >
                        {countDown}
                      </motion.span>
                    </AnimatePresence>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </motion.button>
        </MotionConfig>
      </div>
    </div>
  );
};

function AnimatedText({
  text,
  className,
  delayStep = 0.014,
}: {
  text: string;
  className?: string;
  delayStep?: number;
}) {
  const chars = text.split("");

  return (
    <span className={className} style={{ display: "inline-flex" }}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={text}
          style={{ display: "inline-flex", willChange: "transform" }}
        >
          {chars.map((char, i) => (
            <motion.span
              key={i}
              initial={{ y: 10, opacity: 0, scale: 0.5, filter: "blur(2px)" }}
              animate={{ y: 0, opacity: 1, scale: 1, filter: "blur(0px)" }}
              exit={{ y: -10, opacity: 0, scale: 0.5, filter: "blur(2px)" }}
              transition={{
                type: "spring",
                stiffness: 240,
                damping: 16,
                mass: 1.2,
                delay: i * delayStep,
              }}
              style={{
                display: "inline-block",
                whiteSpace: char === " " ? "pre" : undefined,
              }}
            >
              {char}
            </motion.span>
          ))}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

export default TimedUndoAction;
