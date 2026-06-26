'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  CalendarCheck,
  Package,
  Truck,
  Home,
} from 'lucide-react';

export interface StepItem {
  id: number;
  label: string;
  icon: React.ElementType;
}

/**
 * LocateFlow move-plan phases. Drives both the onboarding gate and the
 * moving-plan progress header: Plan -> Book -> Pack -> Move day -> Settle in.
 */
const defaultItems: StepItem[] = [
  { id: 1, label: 'Plan', icon: ClipboardList },
  { id: 2, label: 'Book', icon: CalendarCheck },
  { id: 3, label: 'Pack', icon: Package },
  { id: 4, label: 'Move day', icon: Truck },
  { id: 5, label: 'Settle in', icon: Home },
];

interface StepPagerProps {
  steps?: StepItem[];
  initialStep?: number;
  /** Notifies the host (onboarding gate / plan header) of the active phase. */
  onStepChange?: (index: number, step: StepItem) => void;
}

export const StepPager: React.FC<StepPagerProps> = ({
  steps = defaultItems,
  initialStep = 0,
  onStepChange,
}) => {
  const [activeIndex, setActiveIndex] = useState(initialStep);

  const goTo = (index: number) => {
    setActiveIndex(index);
    onStepChange?.(index, steps[index]);
  };

  const nextStep = () => goTo((activeIndex + 1) % steps.length);
  const prevStep = () => goTo((activeIndex - 1 + steps.length) % steps.length);

  return (
    <div className="flex flex-col items-center gap-4 select-none">
      <div className="flex h-8 items-center justify-center">
        <AnimatedText
          text={steps[activeIndex].label}
          className="text-[26px] font-extrabold tracking-normal text-foreground"
          delayStep={0.03}
        />
      </div>

      <div className="flex items-center gap-4">
        <button
          title="Previous phase"
          onClick={prevStep}
          className="flex h-14 w-14 cursor-pointer items-center justify-center rounded-full bg-muted text-muted-foreground transition-all duration-[250ms] hover:bg-accent active:scale-95"
        >
          <ChevronLeft size={26} strokeWidth={2.5} />
        </button>

        <div className="relative flex h-16 min-w-[140px] items-center justify-center gap-1 rounded-full border-2 border-border bg-card px-4">
          {steps.map((step, index) => {
            const isActive = index === activeIndex;
            const Icon = step.icon;

            return (
              <div
                key={step.id}
                className="relative flex h-6 w-6 items-center justify-center"
              >
                {isActive && (
                  <motion.div
                    layoutId="active-pill"
                    className="absolute inset-[-8px] z-0 rounded-full bg-transparent"
                    transition={{
                      type: 'spring',
                      stiffness: 300,
                      damping: 30,
                    }}
                  />
                )}

                <AnimatePresence mode="popLayout">
                  <motion.div
                    key={isActive ? 'active' : 'inactive'}
                    className="relative z-10 flex cursor-pointer items-center justify-center"
                    initial={{
                      opacity: 0,
                      filter: 'blur(4px)',
                      scale: isActive ? 0 : 1,
                    }}
                    animate={{
                      opacity: 1,
                      filter: 'blur(0px)',
                      scale: 1,
                    }}
                    exit={{ opacity: 0, filter: 'blur(4px)', scale: 0 }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                    onClick={() => goTo(index)}
                  >
                    {isActive ? (
                      <Icon size={26} className="text-primary" />
                    ) : (
                      <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/40" />
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        <button
          title="Next phase"
          onClick={nextStep}
          className="flex h-14 w-14 cursor-pointer items-center justify-center rounded-full bg-muted text-muted-foreground transition-all duration-[250ms] hover:bg-accent active:scale-95"
        >
          <ChevronRight size={26} strokeWidth={2.5} />
        </button>
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
  const chars = text.split('');

  return (
    <span className={className} style={{ display: 'inline-flex' }}>
      <AnimatePresence mode="popLayout">
        <motion.span
          key={text}
          style={{ display: 'inline-flex', willChange: 'transform' }}
        >
          {chars.map((char, i) => (
            <motion.span
              key={i}
              initial={{
                y: 10,
                opacity: 0,
                scale: 0.5,
                filter: 'blur(2px)',
              }}
              animate={{
                y: 0,
                opacity: 1,
                scale: 1,
                filter: 'blur(0px)',
              }}
              exit={{
                y: -10,
                opacity: 0,
                scale: 0.5,
                filter: 'blur(2px)',
              }}
              transition={{
                type: 'spring',
                stiffness: 240,
                damping: 16,
                mass: 1.2,
                delay: i * delayStep,
              }}
              style={{
                display: 'inline-block',
                whiteSpace: char === ' ' ? 'pre' : undefined,
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
