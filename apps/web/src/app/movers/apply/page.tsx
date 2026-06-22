import type { Metadata } from "next";
import Link from "next/link";
import { getRuntimeConfigValue } from "@/lib/runtime-config";
import { MoverApplyForm } from "@/components/movers/mover-apply-form";

export const metadata: Metadata = {
  title: "List your moving company · LocateFlow",
  description:
    "Apply to be listed as a verified moving company on LocateFlow. Submit your USDOT registration, licensing, and coverage — our team verifies every applicant against the FMCSA register.",
};

// Server-rendered so the MOVER_REGISTRATION_ENABLED gate is evaluated per request.
export const dynamic = "force-dynamic";

export default async function MoverApplyPage() {
  const enabled = (await getRuntimeConfigValue("MOVER_REGISTRATION_ENABLED").catch(() => null))
    ?.trim()
    .toLowerCase();

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-12 sm:py-16">
      <header className="mb-8">
        <span className="inline-flex rounded-full bg-primary/10 px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
          For moving companies
        </span>
        <h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          List your moving company
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
          Get in front of people planning a move. Submit your company details and proof of authority; our team
          verifies every applicant against the public FMCSA register before listing. Listing is free — verified
          movers appear in our licensed-movers directory.
        </p>
      </header>

      {enabled === "true" ? (
        <MoverApplyForm />
      ) : (
        <div className="rounded-[22px] border border-border bg-card/60 p-8 text-center shadow-sm">
          <h2 className="font-display text-2xl font-bold tracking-tight text-foreground">Applications are paused</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            We&apos;re not accepting new mover applications right now. Check back soon.
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
          >
            Back to home
          </Link>
        </div>
      )}

      <p className="mt-8 text-center text-xs leading-relaxed text-muted-foreground">
        Questions? See our{" "}
        <Link href="/legal/terms" className="underline underline-offset-2 transition hover:text-primary">
          terms
        </Link>
        . Submitting does not guarantee listing.
      </p>
    </main>
  );
}
