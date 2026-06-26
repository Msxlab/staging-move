'use client';

import { motion, AnimatePresence } from 'motion/react';

import { useState, useEffect, type FC } from 'react';

import { cn } from '@/lib/utils';

export interface LabeledProgressIndicatorProps {
  /** Rotating captions, e.g. ['Move readiness 60%', 'Packing 8/20 boxes']. */
  labels: string[];
  /** Bar fill, as a CSS width string, e.g. '60%'. */
  progress?: string;
  /** Cycle interval for the rotating labels (ms). Set 0 to disable rotation. */
  intervalMs?: number;
  /** Tone of the fill bar. `success` for healthy budget/packing states. */
  tone?: 'primary' | 'success';
}

/**
 * Reusable labeled progress meter for LocateFlow. Backs the plan-progress
 * header ('Move readiness 60%'), the packing checklist ('Packing 8/20 boxes'),
 * and the spend bar inside the budget card ('Budget spent 72%'). Pass a single
 * label to show a static caption, or several to rotate through related states.
 */
export const LabeledProgressIndicator: FC<LabeledProgressIndicatorProps> = ({
  labels,
  progress = '55%',
  intervalMs = 2000,
  tone = 'primary',
}) => {
  const [labelIndex, setLabelIndex] = useState(0);
  const shouldRotate = labels.length > 1 && intervalMs > 0;

  useEffect(() => {
    if (!shouldRotate) return;
    const interval = setInterval(() => {
      setLabelIndex((prev) => (prev + 1) % labels.length);
    }, intervalMs);

    return () => clearInterval(interval);
  }, [labels.length, intervalMs, shouldRotate]);

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative flex w-full items-center justify-center">
        <AnimatePresence mode="popLayout">
          <motion.span
            key={labelIndex}
            initial={{
              opacity: 0,
              y: 10,
              scale: 2,
              filter: 'blur(4px)',
            }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
              filter: 'blur(0px)',
            }}
            exit={{
              opacity: 0,
              filter: 'blur(4px)',
              scale: 0.9,
            }}
            transition={{
              type: 'spring',
              stiffness: 600,
              damping: 100,
              mass: 10,
            }}
            className="origin-bottom flex w-full items-center justify-center text-3xl font-bold text-muted-foreground will-change-transform"
          >
            {labels[labelIndex]}
          </motion.span>
        </AnimatePresence>
      </div>

      <div className="h-4 w-[320px] overflow-hidden rounded-full border border-border bg-muted shadow-inner">
        <motion.div
          initial={{ width: '0%' }}
          animate={{ width: progress }}
          transition={{ duration: 1, ease: 'easeOut' }}
          className={cn(
            'relative h-full overflow-hidden rounded-full',
            tone === 'success' ? 'bg-success' : 'bg-primary'
          )}
        >
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: '200%' }}
            transition={{
              duration: Math.max(intervalMs, 1500) / 1000,
              repeat: Infinity,
              ease: 'linear',
            }}
            className="absolute inset-y-0 w-full bg-gradient-to-r from-transparent via-white/30 to-transparent"
          />
        </motion.div>
      </div>
    </div>
  );
};
