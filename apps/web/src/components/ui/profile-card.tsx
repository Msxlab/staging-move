'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronUp,
  Globe,
  Star,
  Clock,
  MapPin,
  Tag,
  CalendarDays,
  DollarSign,
  Phone,
  Building2,
  Link as LinkIcon,
} from 'lucide-react';
import { RxArrowTopRight } from 'react-icons/rx';

/**
 * ProviderProfileCard (re-themed + repurposed from the watermelon
 * `profile-card` company/lead profile). LocateFlow use-case: a provider /
 * mover / service-contact profile card (also reused for family-member
 * profiles in sharing). Website + Location + Categories are kept; the
 * Monthly-visits / Heat-Score / ARR / Employees / Founders stat rows are
 * replaced with provider-relevant facts (Rating, Avg quote, Response time,
 * Service area, Years active, Contact). The header sparkline is kept as a
 * rating-trend line. Themed entirely on our sapphire (no-gold) CSS-var
 * tokens.
 */

interface ProviderProfileCardProps {
  /** Provider / company name. */
  name: string;
  website: string;
  location: string;
  categories: string[];
  /** Star rating, e.g. 4.8. */
  rating: number;
  /** Number of reviews backing the rating. */
  reviews: number;
  /** Typical quote, e.g. "$1,200–$1,800". */
  avgQuote: string;
  /** Typical response time, e.g. "~2 hrs". */
  responseTime: string;
  /** Service area, e.g. "Greater Austin, TX". */
  serviceArea: string;
  /** Years in business, e.g. "12 yrs". */
  yearsActive: string;
  /** Primary contact line, e.g. "(512) 555-0142". */
  contact: string;
}

export const ProviderProfileCard: React.FC<ProviderProfileCardProps> = ({
  name,
  website,
  location,
  categories,
  rating,
  reviews,
  avgQuote,
  responseTime,
  serviceArea,
  yearsActive,
  contact,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const springConfig = { type: 'spring', stiffness: 300, damping: 30 } as const;

  return (
    <div className="flex min-h-[500px] w-full items-center justify-center p-4">
      <motion.div
        layout
        transition={springConfig}
        className="w-[20rem] overflow-hidden rounded-xl border border-border bg-card shadow-lg transition-colors duration-500 md:w-[24rem]"
      >
        {/* Header Section */}
        <div
          className="flex cursor-pointer items-center justify-between bg-card p-3.5 transition-colors"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-primary text-primary-foreground shadow-inner">
              <Building2 size={22} />
            </div>
            <span className="truncate text-[15px] font-semibold text-foreground transition-colors">
              {name}
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            {/* Rating-trend sparkline */}
            <div className="w-[3.75rem] sm:w-20">
              <svg
                viewBox="0 0 80 20"
                fill="none"
                className="h-auto w-full text-success"
              >
                <path
                  d="M2 18C15 15 25 5 45 8C65 11 70 2 78 2"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </div>

            <motion.div
              animate={{ rotate: isExpanded ? 0 : 180 }}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground transition-colors duration-200 hover:text-foreground"
            >
              <ChevronUp size={22} />
            </motion.div>
          </div>
        </div>

        {/* Expanded Content */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={springConfig}
              className="rounded-t-3xl border-t-[1.4px] border-border bg-popover text-popover-foreground shadow-2xl transition-colors duration-500"
            >
              <div className="space-y-4 p-5">
                <DataRow icon={<Globe size={16} />} label="Website">
                  <div className="flex items-center gap-1.5 truncate rounded-full border-[1.5px] border-border px-2 py-1 text-[11px] font-medium text-muted-foreground sm:text-[12px]">
                    <LinkIcon size={12} className="shrink-0" />{' '}
                    <span className="truncate">{website}</span>
                  </div>
                </DataRow>

                <DataRow icon={<Star size={16} />} label="Rating">
                  <div className="flex items-center gap-1 rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-[12px] font-bold text-success">
                    {rating.toFixed(1)}
                    <span className="font-medium text-success/70">
                      ({reviews})
                    </span>
                    <RxArrowTopRight size={14} strokeWidth={0.5} />
                  </div>
                </DataRow>

                <DataRow icon={<DollarSign size={16} />} label="Avg quote">
                  <span className="text-[14px] font-semibold text-foreground">
                    {avgQuote}
                  </span>
                </DataRow>

                <DataRow icon={<Clock size={16} />} label="Response time">
                  <span className="text-[14px] font-semibold text-foreground">
                    {responseTime}
                  </span>
                </DataRow>

                <DataRow icon={<MapPin size={16} />} label="Location">
                  <span className="ml-2 truncate text-right text-[14px] font-semibold text-foreground">
                    {location}
                  </span>
                </DataRow>

                <DataRow icon={<MapPin size={16} />} label="Service area">
                  <span className="ml-2 truncate text-right text-[14px] font-semibold text-foreground">
                    {serviceArea}
                  </span>
                </DataRow>

                <DataRow icon={<CalendarDays size={16} />} label="Years active">
                  <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[12px] font-bold text-foreground">
                    {yearsActive}
                  </span>
                </DataRow>

                <DataRow icon={<Tag size={16} />} label="Categories">
                  <div className="flex flex-wrap justify-end gap-2">
                    {categories.map((cat) => (
                      <span
                        key={cat}
                        className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[11px] font-bold whitespace-nowrap text-primary"
                      >
                        {cat}
                      </span>
                    ))}
                  </div>
                </DataRow>

                <DataRow icon={<Phone size={16} />} label="Contact">
                  <a
                    href={`tel:${contact.replace(/[^\d+]/g, '')}`}
                    className="flex shrink-0 items-center gap-2 rounded-full border border-border bg-muted py-1 pr-3 pl-3 text-[12px] font-medium text-foreground transition-colors hover:bg-accent"
                  >
                    <Phone size={12} className="shrink-0" />
                    {contact}
                  </a>
                </DataRow>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

const DataRow = ({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) => (
  <div className="flex items-center justify-between gap-4 py-0.5">
    <div className="flex shrink-0 items-center gap-3 text-muted-foreground">
      {icon}
      <span className="text-[13px] font-medium whitespace-nowrap text-muted-foreground">
        {label}
      </span>
    </div>
    <div className="flex min-w-0 flex-1 justify-end">{children}</div>
  </div>
);

/**
 * Backwards-compatible alias for the original demo export name.
 * New call sites should import `ProviderProfileCard`.
 */
export const ProfileCard = ProviderProfileCard;
