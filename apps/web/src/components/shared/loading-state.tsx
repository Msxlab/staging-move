import { Loader2 } from "lucide-react";

export function LoadingSpinner({ className }: { className?: string }) {
  return (
    <div className="flex items-center justify-center p-8">
      <Loader2 className={`h-8 w-8 animate-spin text-tone-orange-fg ${className || ""}`} />
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-12 w-full rounded-xl bg-foreground/5 animate-pulse" />
      <div className="h-24 w-full rounded-xl bg-foreground/5 animate-pulse" />
      <div className="h-32 w-full rounded-xl bg-foreground/5 animate-pulse" />
    </div>
  );
}

export function ListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-20 w-full rounded-xl bg-foreground/5 animate-pulse" />
      ))}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-8 w-40 rounded-lg bg-foreground/5 animate-pulse" />
          <div className="h-4 w-56 rounded-lg bg-foreground/5 animate-pulse" />
        </div>
        <div className="flex gap-2">
          <div className="h-10 w-32 rounded-xl bg-foreground/5 animate-pulse" />
          <div className="h-10 w-32 rounded-xl bg-foreground/5 animate-pulse" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-2xl border border-border bg-foreground/[0.02] animate-pulse" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <div className="h-48 rounded-2xl border border-border bg-foreground/[0.02] animate-pulse" />
          <div className="h-32 rounded-2xl border border-border bg-foreground/[0.02] animate-pulse" />
        </div>
        <div className="space-y-5">
          <div className="h-40 rounded-2xl border border-border bg-foreground/[0.02] animate-pulse" />
          <div className="h-36 rounded-2xl border border-border bg-foreground/[0.02] animate-pulse" />
        </div>
      </div>
    </div>
  );
}

export function ServicesSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-8 w-32 rounded-lg bg-foreground/5 animate-pulse" />
          <div className="h-4 w-48 rounded-lg bg-foreground/5 animate-pulse" />
        </div>
        <div className="h-10 w-32 rounded-xl bg-foreground/5 animate-pulse" />
      </div>
      <div className="flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-9 w-24 rounded-xl bg-foreground/5 animate-pulse" />
        ))}
      </div>
      <div className="h-10 w-full max-w-md rounded-xl bg-foreground/5 animate-pulse" />
      <div className="space-y-4">
        {Array.from({ length: 2 }).map((_, g) => (
          <div key={g} className="space-y-2">
            <div className="h-5 w-36 rounded bg-foreground/5 animate-pulse" />
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-24 rounded-xl border border-border bg-foreground/[0.02] animate-pulse" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AddressesSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-8 w-32 rounded-lg bg-foreground/5 animate-pulse" />
          <div className="h-4 w-56 rounded-lg bg-foreground/5 animate-pulse" />
        </div>
        <div className="h-10 w-32 rounded-xl bg-foreground/5 animate-pulse" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-44 rounded-2xl border border-border bg-foreground/[0.02] animate-pulse" />
        ))}
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="rounded-xl border border-border bg-foreground/[0.02] overflow-hidden">
      <div className="grid gap-0" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {Array.from({ length: cols }).map((_, i) => (
          <div key={`h-${i}`} className="h-10 bg-foreground/[0.03] border-b border-border animate-pulse" />
        ))}
        {Array.from({ length: rows * cols }).map((_, i) => (
          <div key={i} className="h-12 border-b border-foreground/[0.02] animate-pulse" />
        ))}
      </div>
    </div>
  );
}
