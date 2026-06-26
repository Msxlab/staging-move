'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, MotionConfig } from 'motion/react';
import { BsCheckCircleFill } from 'react-icons/bs';
import { cn } from '@/lib/utils';

type ButtonStatus = 'idle' | 'loading' | 'success' | 'saved';
type Size = 'sm' | 'md' | 'lg';

const SIZE_CONFIG = {
  sm: {
    height: 52,
    circleWidth: 52,
    idleWidth: 108,
    savedWidth: 128,
    text: 'text-[18px]',
    icon: 'text-2xl',
    spinner: 'w-7 h-7',
    gap: 'gap-2',
    padding: 'px-4',
  },
  md: {
    height: 56,
    circleWidth: 56,
    idleWidth: 120,
    savedWidth: 140,
    text: 'text-[20px]',
    icon: 'text-3xl',
    spinner: 'w-8 h-8',
    gap: 'gap-3',
    padding: 'px-5',
  },
  lg: {
    height: 68,
    circleWidth: 68,
    idleWidth: 144,
    savedWidth: 168,
    text: 'text-[22px]',
    icon: 'text-[28px]',
    spinner: 'w-9 h-9',
    gap: 'gap-4',
    padding: 'px-5',
  },
};

interface SaveToggleProps {
  size?: Size;
  /** Idle label, e.g. "Save provider" or "Bookmark". */
  idleText?: string;
  /** Confirmed label, e.g. "Saved" or "Bookmarked". */
  savedText?: string;
  loadingDuration?: number;
  successDuration?: number;
  onStatusChange?: (status: ButtonStatus) => void;
}

/**
 * Save / bookmark control for LocateFlow — bookmark a provider or service,
 * or use it as a form save button. Animates idle → saving (spinner) →
 * success (check) → saved (check + label), and toggles back to idle on
 * click. Repurposed from the demo idle/saved toggle.
 *
 * Re-themed: all colors resolve through our sapphire CSS-var tokens
 * (bg-primary while saving, success check on confirm, bg-muted at rest), so
 * light/dark switch automatically with no hardcoded hex.
 */
export const SaveToggle: React.FC<SaveToggleProps> = ({
  size = 'md',
  idleText = 'Save provider',
  savedText = 'Saved',
  loadingDuration = 1000,
  successDuration = 800,
  onStatusChange,
}) => {
  const [status, setStatus] = useState<ButtonStatus>('idle');

  const cfg = SIZE_CONFIG[size];

  const stableWidth = Math.max(cfg.idleWidth, cfg.savedWidth);

  useEffect(() => {
    onStatusChange?.(status);
  }, [status, onStatusChange]);

  const handleClick = () => {
    if (status === 'idle') {
      setStatus('loading');

      setTimeout(() => {
        setStatus('success');

        setTimeout(() => {
          setStatus('saved');
        }, successDuration);
      }, loadingDuration);
    } else if (status === 'saved') {
      setStatus('idle');
    }
  };

  const isCircle = status === 'loading' || status === 'success';

  // Surface color per status, resolved from theme tokens so light/dark and
  // the per-plan accent track automatically (no hardcoded hex / dark: overrides).
  const getBackgroundColor = () => {
    if (status === 'loading' || status === 'success') {
      return 'hsl(var(--primary))';
    }
    if (status === 'saved') {
      return 'hsl(var(--card))';
    }
    return 'hsl(var(--muted))';
  };

  const getBorderColor = () => {
    if (status === 'saved') {
      return 'hsl(var(--border))';
    }
    return 'transparent';
  };

  const getCheckColor = () => {
    // White check on the filled sapphire pill during success; success-green
    // check once it settles into the saved card.
    if (status === 'success') {
      return 'hsl(var(--primary-foreground))';
    }
    return 'var(--success)';
  };

  return (
    <div className="flex items-center justify-center p-10">
      <MotionConfig
        transition={{
          type: 'spring',
          stiffness: 400,
          damping: 30,
          mass: 1,
        }}
      >
        <motion.button
          onClick={handleClick}
          initial={false}
          aria-label={status === 'saved' ? savedText : idleText}
          animate={{
            width: isCircle ? cfg.circleWidth : stableWidth,
            height: cfg.height,
            backgroundColor: getBackgroundColor(),
          }}
          style={{
            borderWidth: status === 'saved' ? '2px' : '0',
            borderColor: getBorderColor(),
          }}
          transition={{
            type: 'spring',
            stiffness: 200,
            damping: 15,
            mass: 1.2,
            backgroundColor: {
              duration: 0.2,
            },
          }}
          className={cn(
            'relative z-0 flex cursor-pointer items-center justify-center overflow-hidden rounded-full select-none focus:outline-none active:scale-[0.97]',
          )}
        >
          <AnimatePresence mode="popLayout">
            {status === 'idle' && (
              <motion.span
                key="idle"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15, x: -20 }}
                className={`absolute inset-0 flex items-center justify-center font-bold tracking-tight ${cfg.text} text-foreground`}
              >
                {idleText}
              </motion.span>
            )}

            {status === 'loading' && (
              <motion.div
                key="loading"
                initial={{ opacity: 0, scale: 0.8, filter: 'blur(4px)' }}
                animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                exit={{ opacity: 0, scale: 0.8, filter: 'blur(4px)' }}
                className="absolute inset-0 flex items-center justify-center"
              >
                <motion.svg
                  viewBox="0 0 26 26"
                  className={cfg.spinner}
                  animate={{ rotate: 360 }}
                  transition={{
                    repeat: Infinity,
                    duration: 0.7,
                    ease: 'linear',
                  }}
                >
                  <circle
                    cx="13"
                    cy="13"
                    r="10"
                    stroke="hsl(var(--primary-foreground) / 0.35)"
                    strokeWidth="3"
                    fill="none"
                  />
                  <path
                    d="M13 3 A10 10 0 0 1 23 13"
                    stroke="hsl(var(--primary-foreground))"
                    strokeWidth="3"
                    strokeLinecap="round"
                    fill="none"
                  />
                </motion.svg>
              </motion.div>
            )}

            {(status === 'success' || status === 'saved') && (
              <motion.div
                key="check-state"
                layout
                initial={
                  status === 'success'
                    ? { opacity: 0, scale: 0.5, filter: 'blur(4px)' }
                    : { opacity: 1 }
                }
                animate={
                  status === 'success'
                    ? { opacity: 1, scale: 1.15, filter: 'blur(0px)' }
                    : { opacity: 1, scale: 1, y: 0 }
                }
                exit={{ opacity: 0, y: 15, filter: 'blur(4px)' }}
                className={`absolute inset-0 flex items-center justify-center ${status === 'saved' ? `${cfg.gap} ${cfg.padding}` : ''
                  }`}
              >
                <motion.div
                  layout
                  animate={{
                    color: getCheckColor(),
                  }}
                >
                  <BsCheckCircleFill className={`${cfg.icon} z-20`} />
                </motion.div>

                <AnimatePresence mode="popLayout">
                  {status === 'saved' && (
                    <motion.span
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ delay: 0.1 }}
                      className={`font-bold tracking-tight whitespace-nowrap ${cfg.text} z-20 text-foreground`}
                    >
                      {savedText}
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.button>
      </MotionConfig>
    </div>
  );
};
