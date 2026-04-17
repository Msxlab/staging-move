import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

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
    <main className="min-h-screen bg-background">
      <div className={cn("mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-14 sm:px-6 lg:px-8 lg:py-20", className)}>
        <section className="rounded-3xl border bg-card/80 p-8 shadow-sm backdrop-blur sm:p-10">
          {eyebrow ? (
            <span className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-primary">
              {eyebrow}
            </span>
          ) : null}
          <div className="mt-4 max-w-3xl">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">{title}</h1>
            <p className="mt-4 text-base leading-7 text-muted-foreground sm:text-lg">{description}</p>
          </div>
        </section>
        <div className="space-y-6">{children}</div>
      </div>
    </main>
  );
}

export function PublicSection({ title, children, className }: PublicSectionProps) {
  return (
    <section className={cn("rounded-2xl border bg-card p-6 shadow-sm", className)}>
      <h2 className="text-xl font-semibold text-foreground">{title}</h2>
      <div className="mt-3 space-y-4 text-sm leading-7 text-muted-foreground sm:text-base">{children}</div>
    </section>
  );
}
