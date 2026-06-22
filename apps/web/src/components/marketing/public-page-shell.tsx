import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { MarketingHeader } from "@/components/marketing/marketing-header";

type PublicPageShellProps = {
  eyebrow?: string;
  title: string;
  description: string;
  children: ReactNode;
  className?: string;
};

type PublicSectionProps = {
  title: string;
  children: ReactNode;
  className?: string;
};

export function PublicPageShell({ eyebrow, title, description, children, className }: PublicPageShellProps) {
  return (
    <div className="min-h-screen bg-background">
      <MarketingHeader />
      <main className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-44 -top-48 h-[620px] w-[620px] rounded-full bg-primary/10 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-56 -left-44 h-[540px] w-[540px] rounded-full bg-info/10 blur-3xl"
        />
        <div className={cn("container relative flex w-full max-w-6xl flex-col gap-10 py-14 lg:py-20", className)}>
          <section className="border-b border-border/70 pb-10">
            {eyebrow ? (
              <span className="inline-flex rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-primary">
                {eyebrow}
              </span>
            ) : null}
            <div className="mt-4 max-w-3xl">
              <h1 className="font-display text-4xl font-extrabold leading-[1.06] tracking-tight text-foreground sm:text-5xl">
                {title}
              </h1>
              <p className="mt-4 text-base leading-7 text-muted-foreground sm:text-lg">{description}</p>
            </div>
          </section>
          <div className="space-y-6">{children}</div>
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}

export function PublicSection({ title, children, className }: PublicSectionProps) {
  return (
    <section className={cn("rounded-[22px] border border-border bg-card/70 p-6 shadow-sm backdrop-blur", className)}>
      <h2 className="font-display text-2xl font-bold text-foreground">{title}</h2>
      <div className="mt-3 space-y-4 text-sm leading-7 text-muted-foreground sm:text-base">{children}</div>
    </section>
  );
}
