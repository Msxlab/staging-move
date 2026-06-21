import type { Metadata } from "next";
import Link from "next/link";
import { getRuntimeConfigValue } from "@/lib/runtime-config";
import { MoverApplyForm } from "@/components/movers/mover-apply-form";

export const metadata: Metadata = {
  title: "List your moving company · Move",
  description:
    "Apply to be listed as a verified moving company on Move. Submit your USDOT registration, licensing, and coverage — our team verifies every applicant against the FMCSA register.",
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
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">For moving companies</p>
        <h1 className="h1 mt-2 text-3xl text-foreground sm:text-4xl">List your moving company</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Get in front of people planning a move. Submit your company details and proof of authority; our team
          verifies every applicant against the public FMCSA register before listing. Listing is free — verified
          movers appear in our licensed-movers directory.
        </p>
      </header>

      {enabled === "true" ? (
        <MoverApplyForm />
      ) : (
        <div className="rounded-2xl border border-border bg-foreground/5 p-8 text-center">
          <h2 className="h2 text-2xl text-foreground">Applications are paused</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            We&apos;re not accepting new mover applications right now. Check back soon.
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            Back to home
          </Link>
        </div>
      )}

      <p className="mt-8 text-center text-xs text-muted-foreground">
        Questions? See our{" "}
        <Link href="/terms" className="underline underline-offset-2 hover:text-foreground">
          terms
        </Link>
        . Submitting does not guarantee listing.
      </p>
    </main>
  );
}
