import type { Metadata } from "next";
import Link from "next/link";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { PARTNER_REGISTRATION_FLAG } from "@locateflow/shared";
import { PartnerApplyForm } from "@/components/partners/partner-apply-form";

export const metadata: Metadata = {
  title: "List your business · Move",
  description:
    "Apply to receive customer leads on Move as a cleaning or junk-removal partner. Listing is free; our team reviews every applicant.",
};

// Server-rendered so the partner_registration_v1 gate is evaluated per request.
export const dynamic = "force-dynamic";

export default async function PartnerApplyPage() {
  const enabled = await isFeatureEnabled(PARTNER_REGISTRATION_FLAG);

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-12 sm:py-16">
      <header className="mb-8">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">For local services</p>
        <h1 className="mt-2 text-3xl font-bold text-foreground sm:text-4xl">List your business</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Get in front of people in the middle of a move. Submit your company details; our team reviews every
          applicant before you start receiving leads. Listing is free.
        </p>
      </header>

      {enabled ? (
        <PartnerApplyForm />
      ) : (
        <div className="rounded-2xl border border-border bg-foreground/5 p-8 text-center">
          <h2 className="text-2xl font-bold text-foreground">Applications are paused</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            We&apos;re not accepting new partner applications right now. Check back soon.
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
        <Link href="/terms" className="underline underline-offset-2 hover:text-foreground">terms</Link>. Submitting does
        not guarantee listing.
      </p>
    </main>
  );
}
