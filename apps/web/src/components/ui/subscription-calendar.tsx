'use client';

import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  Download,
  X,
  Loader2,
  Check,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { TbCube } from 'react-icons/tb';

/* ---------- Types ---------- */
export interface SubscriptionDay {
  date: number;
  isMuted?: boolean;
  /** Renewal logos / glyphs to render inside the day cell. */
  isLogo?: React.ReactNode[];
  /** Small dots in the top-right corner of a day cell. */
  indicators?: React.ReactNode[];
  /** Total amount of recurring services renewing on this day. */
  dayTotal?: number;
}

export interface SubscriptionCalendarProps {
  month: string;
  year: number;
  days: SubscriptionDay[];
  /** Rolls up into the Monthly Spend card. */
  monthlyTotal: number;
  /** Count of active recurring services for this month. */
  subscriptionsCount: number;
  /** Count of services newly transferred / added this month. */
  newCount: number;
  onPrevMonth?: () => void;
  onNextMonth?: () => void;
  /** Fired when the "add recurring service" form is submitted. */
  onAddService?: (service: { name: string; amount: string; date: string }) => void;
}

/* ---------- Motion ---------- */
const spring = {
  type: 'spring',
  stiffness: 420,
  damping: 28,
  mass: 0.6,
} as const;

/* ---------- Main Component ---------- */
export const SubscriptionCalendar: React.FC<SubscriptionCalendarProps> = ({
  month,
  year,
  days,
  monthlyTotal,
  subscriptionsCount,
  newCount,
  onPrevMonth,
  onNextMonth,
  onAddService,
}) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const [draftName, setDraftName] = useState('');
  const [draftAmount, setDraftAmount] = useState('');
  const [draftDate, setDraftDate] = useState('');

  const handleDownload = () => {
    setIsDownloading(true);
    setTimeout(() => setIsDownloading(false), 2000);
  };

  const handleAddService = () => {
    onAddService?.({ name: draftName, amount: draftAmount, date: draftDate });
    setDraftName('');
    setDraftAmount('');
    setDraftDate('');
    setIsAdding(false);
  };

  return (
    <motion.div
      initial={{ scale: 0.96, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={spring}
      className="relative w-full max-w-[26.25rem] rounded-[26px] border border-border bg-card p-4 text-card-foreground shadow-2xl transition-all duration-500 sm:p-5"
    >
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 overflow-hidden sm:gap-3">
          <h2 className="truncate text-[12px] font-medium text-foreground sm:text-[13px]">
            {month}, {year}
          </h2>
          <span className="hidden cursor-default rounded-full border border-border bg-transparent px-3 py-0.5 text-[10px] whitespace-nowrap text-muted-foreground sm:inline-block">
            Today
          </span>
          <div className="ml-1 flex items-center gap-1 sm:gap-2">
            <button
              title="backward"
              onClick={onPrevMonth}
              className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              title="forward"
              onClick={onNextMonth}
              className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
        <button
          title="add recurring service"
          onClick={() => setIsAdding(true)}
          className="flex h-7 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition-transform hover:scale-105 active:scale-95 sm:h-7 sm:w-11"
        >
          <Plus size={16} />
        </button>
      </div>

      <div className="">
        <AnimatePresence>
          {isAdding && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 10 }}
              className="absolute inset-0 z-50 flex flex-col items-center justify-center rounded-[25px] bg-card/95 p-4 backdrop-blur-md sm:p-6"
            >
              <button
                onClick={() => setIsAdding(false)}
                className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
              >
                <X size={20} />
              </button>
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Plus size={24} />
              </div>
              <h3 className="mb-1 text-sm font-bold text-foreground">
                Add Recurring Service
              </h3>
              <p className="mb-6 text-center text-[10px] text-muted-foreground">
                Track a subscription or recurring move-related charge.
              </p>
              <div className="flex w-full flex-col gap-2">
                <input
                  type="text"
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  placeholder="Service Name (e.g. Comcast Internet)"
                  className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-[11px] text-foreground outline-none focus:border-primary"
                />
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    type="text"
                    value={draftAmount}
                    onChange={(e) => setDraftAmount(e.target.value)}
                    placeholder="Amount"
                    className="flex-1 rounded-lg border border-border bg-transparent px-3 py-2 text-[11px] text-foreground outline-none focus:border-primary"
                  />
                  <input
                    type="text"
                    value={draftDate}
                    onChange={(e) => setDraftDate(e.target.value)}
                    placeholder="Day"
                    className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-[11px] text-foreground outline-none focus:border-primary sm:w-20"
                  />
                </div>
                <button
                  onClick={handleAddService}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2 text-[11px] font-bold text-primary-foreground transition-opacity hover:opacity-90"
                >
                  <Check size={14} /> Add Service
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isSearching && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 10 }}
              className="absolute inset-0 z-50 flex flex-col items-center justify-center rounded-[25px] bg-card/95 p-4 backdrop-blur-md sm:p-6"
            >
              <button
                onClick={() => setIsSearching(false)}
                className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
              >
                <X size={20} />
              </button>
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Search size={24} />
              </div>
              <h3 className="mb-1 text-sm font-bold text-foreground">
                Search Services
              </h3>
              <div className="mt-4 w-full">
                <input
                  autoFocus
                  type="text"
                  placeholder="Type to search..."
                  className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-[11px] text-foreground outline-none focus:border-primary"
                />
              </div>
              <div className="mt-4 flex max-h-32 w-full flex-col gap-2 overflow-y-auto">
                <p className="text-center text-[10px] text-muted-foreground">
                  Start typing to see results
                </p>
              </div>
            </motion.div>
          )}

          {isSummaryOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 10 }}
              className="absolute inset-0 z-50 flex flex-col items-center justify-center rounded-[25px] bg-card/95 p-4 backdrop-blur-md sm:p-6"
            >
              <button
                onClick={() => setIsSummaryOpen(false)}
                className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
              >
                <X size={20} />
              </button>
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <TbCube size={24} />
              </div>
              <h3 className="mb-1 text-sm font-bold text-foreground">
                Monthly Summary
              </h3>
              <div className="mt-4 grid w-full grid-cols-2 gap-3">
                <div className="rounded-lg bg-muted p-3">
                  <div className="text-[9px] text-muted-foreground">Active</div>
                  <div className="text-sm font-bold text-foreground">
                    {subscriptionsCount}
                  </div>
                </div>
                <div className="rounded-lg bg-muted p-3">
                  <div className="text-[9px] text-muted-foreground">New</div>
                  <div className="text-sm font-bold text-foreground">
                    {newCount}
                  </div>
                </div>
                <div className="col-span-2 rounded-lg bg-primary/10 p-3">
                  <div className="text-[9px] text-primary">Monthly Spend</div>
                  <div className="text-sm font-bold text-primary">
                    ${monthlyTotal.toFixed(2)}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div>
          <div className="mb-2 grid grid-cols-7 gap-1 text-[8px] font-semibold tracking-wider text-muted-foreground sm:text-[9px]">
            {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map((d) => (
              <div
                key={d}
                className="rounded-full border-border bg-muted/60 py-1.5 text-center"
              >
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
            {days.map((day, idx) => {
              const uniqueId = `day-${day.date}-${idx}`;
              const isActive = selectedId === uniqueId;

              return (
                <motion.button
                  key={uniqueId}
                  layout
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setSelectedId(uniqueId)}
                  transition={spring}
                  title={
                    day.dayTotal
                      ? `Renewals: $${day.dayTotal.toFixed(2)}`
                      : undefined
                  }
                  className={`relative flex aspect-square flex-col items-center justify-center rounded-xl border text-[10px] font-medium transition-colors sm:h-12 sm:text-[11px] ${
                    day.isMuted
                      ? 'border-border/50 bg-muted/40 text-muted-foreground/50'
                      : 'border-border bg-muted/40 text-foreground hover:border-primary/40'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeGlow"
                      className="absolute inset-0 z-0 rounded-xl border-[1.5px] border-primary bg-primary/10"
                      transition={spring}
                    />
                  )}

                  <div className="relative z-10 flex flex-col items-center justify-start gap-0.5 sm:gap-1">
                    <span>{day.date}</span>
                    <span className="scale-75 sm:scale-100">{day.isLogo}</span>
                  </div>

                  {day.indicators && (
                    <div className="absolute top-1 right-1 flex gap-0.5 sm:top-1.5 sm:right-1.5">
                      {day.indicators}
                    </div>
                  )}
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer Info*/}
      <div className="mt-5 flex items-center justify-between gap-2 text-[8px] font-semibold tracking-widest text-muted-foreground sm:text-[9px]">
        <div className="flex items-center gap-2 sm:gap-4">
          <span className="flex cursor-default items-center gap-1.5 transition-colors hover:text-primary">
            <span className="h-1 w-1 rounded-full bg-primary sm:h-1.5 sm:w-1.5" />
            MONTHLY
          </span>
          <span className="flex cursor-default items-center gap-1.5 transition-colors hover:text-foreground">
            <span className="h-1 w-1 rounded-full bg-secondary sm:h-1.5 sm:w-1.5" />
            YEARLY
          </span>
        </div>

        <span className="whitespace-nowrap text-muted-foreground">
          <span className="text-foreground">{subscriptionsCount}</span> SUBS /{' '}
          <span className="text-foreground">{newCount}</span> NEW
        </span>
      </div>

      {/* Bottom Bar*/}
      <div className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-4">
        <div className="flex gap-3 text-muted-foreground sm:gap-4">
          <Search
            size={16}
            onClick={() => setIsSearching(true)}
            className="shrink-0 cursor-pointer transition-colors hover:text-foreground"
          />
          <button
            onClick={handleDownload}
            disabled={isDownloading}
            className="relative flex items-center justify-center transition-colors hover:text-foreground"
          >
            {isDownloading ? (
              <Loader2 size={16} className="animate-spin text-primary" />
            ) : (
              <Download size={16} className="shrink-0 cursor-pointer" />
            )}
          </button>
          <TbCube
            size={16}
            onClick={() => setIsSummaryOpen(true)}
            className="shrink-0 cursor-pointer transition-colors hover:text-foreground"
          />
        </div>

        <div className="truncate text-[9px] font-medium text-muted-foreground sm:text-[10px]">
          MONTHLY SPEND :{' '}
          <span className="ml-1 text-[11px] font-bold text-foreground sm:text-[12px]">
            ${monthlyTotal.toFixed(2)}
          </span>
        </div>
      </div>
    </motion.div>
  );
};
