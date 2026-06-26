"use client";

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  MoreVertical,
  Download,
  ChevronDown,
  Check,
  Printer,
  Share2,
  RefreshCw,
} from 'lucide-react';

/**
 * MonthlyBudgetCard (re-themed + repurposed from the watermelon
 * `credit-usage-card`). LocateFlow use-case: the dashboard MONTHLY SPEND /
 * budget card. The AI-credit ring/usage-history has been repurposed into a
 * percent-of-monthly-budget-spent progress bar plus a this-month expense /
 * subscription line-item table. Themed entirely on our sapphire (no-gold)
 * CSS-var tokens.
 */

interface SpendLineItem {
  /** e.g. "Jun 24" */
  date: string;
  /** Service / merchant, e.g. "Allied Van Lines" */
  service: string;
  /** Category, e.g. "Movers" */
  category: string;
  /** Formatted amount, e.g. "$1,240.00" */
  amount: string;
}

interface MonthlyBudgetCardProps {
  /** Percent of the monthly budget already spent. */
  spentPercent?: number;
  /** Monthly budget label, e.g. "$2,400 BUDGET". */
  monthlyBudgetLabel?: string;
  /** Amount spent so far this month, e.g. "$1,354". */
  spentLabel?: string;
  /** Amount remaining this month, e.g. "$1,046". */
  remainingLabel?: string;
  /** This-month expense + subscription line items. */
  lineItems?: SpendLineItem[];
  onRolloverChange?: (enabled: boolean) => void;
  onManageBudget?: () => void;
  onViewAll?: () => void;
}

const PERIOD_OPTIONS = ['This Month', 'Last Month', 'Quarter'];

const popoverAnim = {
  initial: { opacity: 0, y: 6, scale: 0.97 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: 6, scale: 0.97 },
  transition: { type: 'spring' as const, stiffness: 400, damping: 28 },
} as const;

export const MonthlyBudgetCard: React.FC<MonthlyBudgetCardProps> = ({
  spentPercent = 56.4,
  monthlyBudgetLabel = '$2,400 BUDGET',
  spentLabel = '$1,354',
  remainingLabel = '$1,046',
  lineItems = [],
  onRolloverChange,
  onManageBudget,
  onViewAll,
}) => {
  const [rollover, setRollover] = useState(true);
  const [activePopover, setActivePopover] = useState<'more' | 'period' | null>(
    null,
  );
  const [selectedPeriod, setSelectedPeriod] = useState('This Month');
  const [downloadDone, setDownloadDone] = useState(false);
  const segments = 75;

  const moreRef = useRef<HTMLDivElement>(null);
  const periodRef = useRef<HTMLDivElement>(null);

  const handleToggleRollover = () => {
    const newState = !rollover;
    setRollover(newState);
    onRolloverChange?.(newState);
  };

  const handleDownload = () => {
    // Export this-month spend report as CSV
    const headers = ['Date', 'Service', 'Category', 'Amount'];
    const rows = lineItems.map((r) => [r.date, r.service, r.category, r.amount]);
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'monthly-spend-report.csv';
    a.click();
    URL.revokeObjectURL(url);
    setDownloadDone(true);
    setTimeout(() => setDownloadDone(false), 2000);
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setActivePopover((prev) => (prev === 'more' ? null : prev));
      }
      if (periodRef.current && !periodRef.current.contains(e.target as Node)) {
        setActivePopover((prev) => (prev === 'period' ? null : prev));
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="flex w-full flex-col items-center justify-center bg-transparent p-4 font-sans transition-colors duration-500 sm:p-8 md:p-12">
      <div className="w-full max-w-[33.75rem] overflow-hidden rounded-[1.75rem] border border-border bg-card font-mono text-card-foreground shadow-xl transition-all duration-500 select-none">
        {/* Top Header */}
        <div className="flex flex-col items-start justify-between gap-4 bg-muted/40 px-4 py-5 sm:flex-row sm:items-center sm:px-6 md:px-8">
          <div>
            <h3 className="mb-1 text-[9px] font-bold tracking-[0.2em] text-muted-foreground uppercase">
              Budget Used
            </h3>
            <span className="font-sans text-2xl font-medium text-foreground sm:text-3xl">
              {spentPercent}%
            </span>
          </div>

          <div className="mt-1 flex items-center gap-2 self-end sm:self-auto">
            <span className="max-w-[9.375rem] text-right text-[9px] leading-tight font-bold tracking-wider text-muted-foreground uppercase sm:text-[10px]">
              Roll unused budget into next month
            </span>
            <button
              title="toggle"
              onClick={handleToggleRollover}
              className={`relative flex h-[1.1875rem] w-10 shrink-0 items-center rounded-full border-[1.4px] p-0.5 transition-colors duration-200 ${
                rollover
                  ? 'border-success/40 bg-success/15'
                  : 'border-border bg-muted'
              }`}
            >
              <motion.div
                animate={{ x: rollover ? 17 : 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                className={`h-3 w-4 ${rollover ? 'bg-success' : 'bg-muted-foreground/60'} rounded-full shadow-sm`}
              />
            </button>
          </div>
        </div>

        {/* Progress Bar — % of monthly budget spent */}
        <div className="flex h-3 gap-px bg-muted/40 px-4 sm:gap-1 sm:px-6 md:px-8">
          {[...Array(segments)].map((_, i) => {
            const isFilled = i < (spentPercent / 100) * segments;
            return (
              <div
                key={i}
                className={`flex-1 rounded-full transition-all duration-700 ${
                  isFilled ? 'bg-primary' : 'bg-muted'
                }`}
                style={{ opacity: isFilled ? 1 - i * 0.004 : 1 }}
              />
            );
          })}
        </div>

        <div className="flex items-center justify-between bg-muted/40 px-4 py-4 text-[9px] font-bold sm:px-6 sm:text-[10px] md:px-8">
          <span className="text-muted-foreground">
            {spentLabel}{' '}
            <span className="text-muted-foreground/70">
              / {monthlyBudgetLabel}
            </span>
          </span>
          <span className="text-muted-foreground">
            {remainingLabel}{' '}
            <span className="hidden text-muted-foreground/70 xs:inline">
              LEFT
            </span>
          </span>
        </div>

        <div className="h-px w-full border-b-2 border-dashed border-border/60" />

        {/* This-month spend header */}
        <div className="flex flex-row flex-wrap items-center justify-between gap-2 bg-muted/40 px-4 pt-4 pb-4 sm:flex-nowrap sm:px-6 md:px-8">
          <div className="flex flex-shrink-0 items-center gap-2">
            <h4 className="font-sans text-sm font-medium whitespace-nowrap text-foreground sm:text-base">
              This Month's Spend
            </h4>
            <button
              onClick={onViewAll}
              title="view all transactions"
              className="flex-shrink-0 rounded-full border border-border px-2 py-0.5 text-center text-[9px] whitespace-nowrap text-muted-foreground transition-colors hover:bg-accent active:scale-95"
            >
              View all transactions
            </button>
          </div>

          {/* Period selector */}
          <div ref={periodRef} className="relative flex-shrink-0">
            <button
              title="period"
              onClick={() =>
                setActivePopover((prev) =>
                  prev === 'period' ? null : 'period',
                )
              }
              className="flex items-center gap-1 rounded-xl border border-border px-2 py-1 text-[9px] whitespace-nowrap text-muted-foreground transition-colors hover:bg-accent sm:gap-2"
            >
              {selectedPeriod}{' '}
              <ChevronDown
                size={10}
                className={`transition-transform ${activePopover === 'period' ? 'rotate-180' : ''}`}
              />
            </button>
            <AnimatePresence>
              {activePopover === 'period' && (
                <motion.div
                  {...popoverAnim}
                  className="absolute top-full right-0 z-50 mt-2 w-36 overflow-hidden rounded-2xl border border-border bg-popover py-1.5 text-popover-foreground shadow-2xl"
                >
                  {PERIOD_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => {
                        setSelectedPeriod(opt);
                        setActivePopover(null);
                      }}
                      className={`flex w-full items-center justify-between px-4 py-2 text-left text-[11px] transition-colors ${selectedPeriod === opt ? 'font-medium text-primary' : 'text-muted-foreground hover:bg-accent'}`}
                    >
                      {opt}
                      {selectedPeriod === opt && <Check size={11} />}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Table Wrapper — expense + subscription line items */}
        <div className="no-scrollbar overflow-x-auto bg-muted/40">
          <div className="min-w-[30rem] space-y-0.5 border-b-[1.4px] border-border px-4 py-2 sm:px-6 md:px-8">
            <div className="grid grid-cols-4 px-1 pb-2 text-[10px] font-bold tracking-[0.15em] text-muted-foreground uppercase">
              <span>Date</span>
              <span>Service</span>
              <span>Category</span>
              <span className="text-right">Amount</span>
            </div>
            {lineItems.map((row, idx) => (
              <div
                key={idx}
                className="group grid grid-cols-4 border-t-[1.5px] border-border/60 px-1 py-2 text-[10.5px] text-muted-foreground transition-colors hover:bg-card"
              >
                <span className="group-hover:text-foreground">
                  {row.date}
                </span>
                <span className="truncate pr-2 font-medium group-hover:text-foreground">
                  {row.service}
                </span>
                <span className="truncate pr-2 group-hover:text-foreground">
                  {row.category}
                </span>
                <span className="text-right font-bold group-hover:text-foreground">
                  {row.amount}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer*/}
        <div className="flex flex-col items-center justify-between gap-4 bg-card px-4 pt-4 pb-4 sm:flex-row sm:px-6 md:px-8">
          <div className="flex items-center gap-3 self-start text-muted-foreground sm:self-auto">
            {/* More Options */}
            <div ref={moreRef} className="relative flex items-center">
              <button
                title="more"
                onClick={() =>
                  setActivePopover((prev) => (prev === 'more' ? null : 'more'))
                }
                className="flex items-center justify-center"
              >
                <MoreVertical
                  size={16}
                  className="cursor-pointer transition-colors hover:text-foreground"
                />
              </button>
              <AnimatePresence>
                {activePopover === 'more' && (
                  <motion.div
                    {...popoverAnim}
                    className="absolute bottom-full left-0 z-50 mb-2 w-48 overflow-hidden rounded-2xl border border-border bg-popover py-1.5 text-popover-foreground shadow-2xl"
                  >
                    {[
                      {
                        label: 'Export spend report',
                        icon: <Download size={12} />,
                        action: handleDownload,
                      },
                      {
                        label: 'Print',
                        icon: <Printer size={12} />,
                        action: () => {
                          window.print();
                          setActivePopover(null);
                        },
                      },
                      {
                        label: 'Share report',
                        icon: <Share2 size={12} />,
                        action: () => setActivePopover(null),
                      },
                      {
                        label: 'Refresh data',
                        icon: <RefreshCw size={12} />,
                        action: () => setActivePopover(null),
                      },
                    ].map((opt) => (
                      <button
                        key={opt.label}
                        onClick={opt.action}
                        className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[12px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      >
                        <span className="text-muted-foreground/70">
                          {opt.icon}
                        </span>
                        {opt.label}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="h-4 w-px bg-border" />

            {/* Export spend report (CSV) */}
            <button
              title="export spend report"
              onClick={handleDownload}
              className="relative flex items-center justify-center"
            >
              <motion.div
                animate={{ scale: downloadDone ? 1.15 : 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                className="flex items-center justify-center"
              >
                <Download
                  size={16}
                  className={`cursor-pointer transition-colors ${downloadDone ? 'text-success' : 'hover:text-foreground'}`}
                />
              </motion.div>
            </button>
          </div>

          <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-end">
            <div className="flex items-center gap-1.5 py-1">
              <div className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                S
              </div>
              <span className="text-[9px] font-bold tracking-tighter text-muted-foreground uppercase">
                Synced via Stripe
              </span>
            </div>
            <button
              title="manage budget"
              onClick={onManageBudget}
              className="font-sans rounded-full border border-border px-3 py-1.5 text-[10px] font-normal whitespace-nowrap text-foreground transition-all hover:bg-primary hover:text-primary-foreground sm:text-[11px]"
            >
              Manage budget
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
};

/**
 * Backwards-compatible alias. The shadcn-pilot dev page imports
 * `CreditUsageCard`; it now renders the repurposed Monthly Budget card.
 * New call sites should import `MonthlyBudgetCard`.
 */
export const CreditUsageCard = MonthlyBudgetCard;
