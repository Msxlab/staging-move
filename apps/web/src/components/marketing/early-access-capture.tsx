import { Mail } from "lucide-react";
import { WaitlistForm } from "./waitlist-form";

/**
 * Early-access / newsletter capture for the public home.
 *
 * Reuses the existing WaitlistForm (client component) and its
 * /api/waitlist endpoint. We post against the MOBILE_ANY target — the
 * most general "notify me when it's ready" bucket in the waitlist enum —
 * with a dedicated `source` so home-page signups are attributable in the
 * admin waitlist view without inventing a new target enum value.
 */
export function EarlyAccessCapture() {
  return (
    <section className="container py-20 border-t">
      <div className="mx-auto max-w-2xl rounded-2xl border bg-card/60 px-6 py-10 text-center sm:px-10">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Mail className="h-6 w-6" />
        </div>
        <h2 className="mt-5 text-2xl md:text-3xl font-bold tracking-tight">
          Get early access &amp; moving tips
        </h2>
        <p className="mt-3 text-muted-foreground">
          Join the list for product updates, new-city checklists, and renewal
          reminders worth knowing about. No spam — unsubscribe anytime.
        </p>
        <div className="mt-6 mx-auto max-w-md text-left">
          <WaitlistForm
            target="MOBILE_ANY"
            source="home-early-access"
            submitLabel="Notify me"
            helper="One email when there's something worth your time. No marketing lists."
            successMessage="You're in. We'll be in touch when there's something worth sharing."
          />
        </div>
      </div>
    </section>
  );
}
