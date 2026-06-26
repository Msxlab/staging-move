"use client";

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Check,
  Star,
  Plus,
} from 'lucide-react';
import { IoClose } from 'react-icons/io5';
import { cn } from '@/lib/utils';

/**
 * ProvidersDirectory (re-themed + repurposed from the watermelon
 * `integration-card` app-marketplace grid). LocateFlow use-case: the
 * providers / services marketplace + directory (movers, utilities, internet,
 * insurance). The app tiles are now provider/service cards (logo, name,
 * rating, Connect / Add service), the "All types" filter maps to provider
 * category, "All use cases" maps to move-stage, and the Marketplace/Internal/
 * Third-party tabs become Recommended/My services/Local. Themed entirely on
 * our sapphire (no-gold) CSS-var tokens.
 */

/* ---------- Types ---------- */
export interface ProviderItem {
  id: string;
  name: string;
  /** Service category line, e.g. "MOVERS · LICENSED & INSURED". */
  serviceLine: string;
  description: string;
  /** Filterable category tags, e.g. ["Movers"]. */
  tags: string[];
  /** Star rating, e.g. 4.8. */
  rating: number;
  /** Number of reviews, e.g. 312. */
  reviews: number;
  /** Whether the provider is currently accepting new jobs. */
  available: boolean;
  /** Whether the user has already added this provider to their move. */
  added?: boolean;
  icon: React.ReactNode;
}

interface ProvidersDirectoryProps {
  items: ProviderItem[];
  title: string;
  onConnect?: (item: ProviderItem) => void;
}

/* ---------- Sub-components ---------- */
const FilterButton: React.FC<{
  label: string;
  active?: boolean;
  onClick: () => void;
  selected?: string;
}> = ({ label, active, onClick, selected }) => (
  <button
    onClick={onClick}
    className={cn(
      'relative flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] transition active:scale-95',
      active
        ? 'border-border bg-accent text-foreground'
        : 'border-border bg-muted/50 text-muted-foreground hover:text-foreground',
    )}
  >
    {selected || label}
    <ChevronDown
      size={12}
      className={cn(
        'transition-transform duration-300',
        active ? 'rotate-180' : '',
      )}
    />
  </button>
);

const ProviderCard: React.FC<{
  item: ProviderItem;
  onConnect?: (item: ProviderItem) => void;
}> = ({ item, onConnect }) => {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex gap-4 border-b border-border px-5 py-4 transition-colors last:rounded-b-[14px] last:border-b-[1.6px] hover:bg-accent/50"
    >
      {/* Logo */}
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-primary">
        {item.icon}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="truncate">
            <h3 className="truncate text-[14px] font-medium text-foreground">
              {item.name}
            </h3>
            <p className="mt-0.5 truncate text-[10px] tracking-wider text-muted-foreground uppercase">
              {item.serviceLine}
            </p>
          </div>

          {item.available && (
            <span className="shrink-0 rounded-full border border-success/40 bg-success/10 px-2 py-0.5 pt-1 text-[9px] font-bold text-success">
              AVAILABLE
            </span>
          )}
        </div>

        <p className="mt-2 max-w-full text-[12px] leading-relaxed text-muted-foreground">
          {item.description}
        </p>

        <div className="mt-3 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-semibold text-foreground">
              <Star size={10} className="fill-primary text-primary" />
              {item.rating.toFixed(1)}
              <span className="font-normal text-muted-foreground">
                ({item.reviews})
              </span>
            </span>
            {item.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>

          <button
            onClick={() => onConnect?.(item)}
            className={cn(
              'flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold transition active:scale-95',
              item.added
                ? 'border border-success/40 bg-success/10 text-success'
                : 'bg-primary text-primary-foreground hover:opacity-90',
            )}
          >
            {item.added ? (
              <>
                <Check size={11} /> Added
              </>
            ) : (
              <>
                <Plus size={11} /> Add service
              </>
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );
};

/* ---------- Main ---------- */
export const ProvidersDirectory: React.FC<ProvidersDirectoryProps> = ({
  items,
  title,
  onConnect,
}) => {
  const [activePopover, setActivePopover] = useState<
    'category' | 'stage' | 'more' | null
  >(null);
  const [selectedCategory, setSelectedCategory] = useState('All categories');
  const [selectedStage, setSelectedStage] = useState('All stages');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node)
      ) {
        setActivePopover(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter Logic
  const filteredItems = items.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      selectedCategory === 'All categories' ||
      item.tags.includes(selectedCategory);
    const matchesStage =
      selectedStage === 'All stages' ||
      item.serviceLine.includes(selectedStage.toUpperCase());
    return matchesSearch && matchesCategory && matchesStage;
  });

  // Pagination Logic
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const paginatedItems = filteredItems.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  const categoryOptions = [
    'All categories',
    'Movers',
    'Utilities',
    'Internet',
    'Insurance',
  ];
  const stageOptions = [
    'All stages',
    'Pre-move',
    'Move day',
    'Post-move',
  ];

  return (
    <div className="text-foreground flex w-full flex-col items-center bg-transparent px-4 py-8">
      <div className="w-full max-w-[36.25rem] overflow-hidden rounded-[22px] border border-border bg-card shadow-2xl transition-all duration-300">
        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-border bg-muted/40 px-5 pt-3">
          {['Recommended', 'My services', 'Local'].map((tab, i) => (
            <button
              key={tab}
              className={cn(
                'relative px-3 pb-3 text-[12px] font-medium transition-colors',
                i === 0
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {tab}
              {i === 0 && (
                <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary" />
              )}
            </button>
          ))}
        </div>

        {/* Header */}
        <header className="flex items-center justify-between px-5 py-4">
          <h2 className="text-sm font-semibold tracking-tight text-foreground">
            {title}
          </h2>
          <button
            title="close"
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-all hover:bg-accent hover:text-foreground active:scale-90"
          >
            <IoClose size={18} />
          </button>
        </header>

        {/* Filters & Search */}
        <div className="relative flex flex-col items-stretch gap-3 rounded-t-[14px] border-t border-b border-border bg-muted/40 px-5 py-4 md:flex-row md:items-center">
          <div className="no-scrollbar flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
            <FilterButton
              label="All categories"
              selected={
                selectedCategory !== 'All categories'
                  ? selectedCategory
                  : undefined
              }
              active={activePopover === 'category'}
              onClick={() =>
                setActivePopover(
                  activePopover === 'category' ? null : 'category',
                )
              }
            />
            <FilterButton
              label="All stages"
              selected={
                selectedStage !== 'All stages' ? selectedStage : undefined
              }
              active={activePopover === 'stage'}
              onClick={() =>
                setActivePopover(activePopover === 'stage' ? null : 'stage')
              }
            />
            <FilterButton
              label="More"
              active={activePopover === 'more'}
              onClick={() =>
                setActivePopover(activePopover === 'more' ? null : 'more')
              }
            />
          </div>

          <div className="hidden flex-1 md:block" />

          <div className="group relative w-full md:w-56">
            <Search
              size={14}
              className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-foreground"
            />
            <input
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search providers..."
              className="w-full rounded-lg border border-border bg-card py-1.5 pr-4 pl-9 text-[12px] text-foreground placeholder-muted-foreground transition-all focus:border-ring focus:outline-none"
            />
          </div>

          {/* Global Popover */}
          <AnimatePresence>
            {activePopover && (
              <motion.div
                ref={popoverRef}
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 4 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute top-full right-5 left-5 z-50 w-auto overflow-hidden rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-2xl md:right-auto md:left-5 md:min-w-48"
              >
                {activePopover === 'category' &&
                  categoryOptions.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => {
                        setSelectedCategory(opt);
                        setActivePopover(null);
                        setCurrentPage(1);
                      }}
                      className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-[12px] font-medium text-foreground transition-colors hover:bg-accent"
                    >
                      {opt}
                      {selectedCategory === opt && (
                        <Check size={12} className="text-primary" />
                      )}
                    </button>
                  ))}
                {activePopover === 'stage' &&
                  stageOptions.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => {
                        setSelectedStage(opt);
                        setActivePopover(null);
                        setCurrentPage(1);
                      }}
                      className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-[12px] font-medium text-foreground transition-colors hover:bg-accent"
                    >
                      {opt}
                      {selectedStage === opt && (
                        <Check size={12} className="text-primary" />
                      )}
                    </button>
                  ))}
                {activePopover === 'more' && (
                  <div className="space-y-1 p-2">
                    <p className="px-2 pb-2 text-[9px] font-bold tracking-wider text-muted-foreground uppercase">
                      Advanced
                    </p>
                    <button className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                      Sort by Rating
                    </button>
                    <button className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                      Sort by Nearest
                    </button>
                    <button
                      onClick={() => {
                        setSearchQuery('');
                        setSelectedCategory('All categories');
                        setSelectedStage('All stages');
                        setActivePopover(null);
                        setCurrentPage(1);
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] font-medium text-destructive transition-colors hover:bg-accent"
                    >
                      Reset Filters
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* List */}
        <div className="no-scrollbar max-h-[32.5rem] overflow-y-auto bg-card">
          <AnimatePresence mode="popLayout">
            {paginatedItems.map((item) => (
              <ProviderCard
                key={item.id}
                item={item}
                onConnect={onConnect}
              />
            ))}
            {paginatedItems.length === 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-3 py-24 text-center"
              >
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-border bg-muted">
                  <Search size={20} className="text-muted-foreground" />
                </div>
                <p className="text-[14px] font-medium tracking-tight text-foreground">
                  No providers found
                </p>
                <p className="text-[12px] text-muted-foreground">
                  Try adjusting your search or filters
                </p>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory('All categories');
                    setSelectedStage('All stages');
                  }}
                  className="text-[12px] font-bold text-foreground hover:underline"
                >
                  Clear all filters
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <footer className="flex flex-col items-center justify-between gap-4 border-t border-border bg-muted/30 px-6 py-4 text-[11px] text-muted-foreground sm:flex-row">
          <span className="font-medium">
            {filteredItems.length > 0
              ? (currentPage - 1) * itemsPerPage + 1
              : 0}{' '}
            – {Math.min(currentPage * itemsPerPage, filteredItems.length)} of{' '}
            {filteredItems.length} providers
          </span>

          <div className="flex items-center gap-1">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((prev) => prev - 1)}
              className="rounded-lg p-1.5 transition-all hover:bg-accent disabled:opacity-30"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="flex items-center gap-1.5 px-2">
              {[...Array(totalPages)].map((_, i) => {
                const pageNum = i + 1;
                if (
                  totalPages > 5 &&
                  pageNum > 2 &&
                  pageNum < totalPages - 1 &&
                  Math.abs(pageNum - currentPage) > 1
                ) {
                  if (pageNum === 3 || pageNum === totalPages - 2)
                    return (
                      <span key={pageNum} className="px-1 opacity-50">
                        …
                      </span>
                    );
                  return null;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={cn(
                      'flex h-7 w-7 items-center justify-center rounded-lg text-[11px] font-bold transition-all',
                      currentPage === pageNum
                        ? 'border border-primary/30 bg-primary/10 text-primary shadow-sm'
                        : 'text-muted-foreground hover:bg-accent',
                    )}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            <button
              disabled={currentPage === totalPages || totalPages === 0}
              onClick={() => setCurrentPage((prev) => prev + 1)}
              className="rounded-lg p-1.5 transition-all hover:bg-accent disabled:opacity-30"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};

/**
 * Backwards-compatible aliases for the original demo export names.
 * New call sites should import `ProvidersDirectory` / `ProviderItem`.
 */
export const IntegrationsCard = ProvidersDirectory;
export type IntegrationItem = ProviderItem;
