import type { Metadata } from "next";
import { Ban, Eye, MailMinus, UserCog } from "lucide-react";
import { PublicPageShell, PublicSection } from "@/components/marketing/public-page-shell";

export const metadata: Metadata = {
  title: "California Privacy Notice (CCPA / CPRA)",
  description: "Your privacy rights under California law.",
  alternates: { canonical: "/ccpa-privacy-notice" },
};

const highlights = [
  {
    icon: Eye,
    title: "Right to know",
    description: "Californians can request a summary of the categories and specific pieces of personal information LocateFlow has collected about them.",
  },
  {
    icon: UserCog,
    title: "Right to correct & delete",
    description: "You can correct inaccurate data and request deletion of personal information LocateFlow holds about you, subject to legal exceptions.",
  },
  {
    icon: Ban,
    title: "No sale of personal info",
    description: "LocateFlow does not sell personal information and does not share it for cross-context behavioral advertising.",
  },
  {
    icon: MailMinus,
    title: "Opt-out & non-discrimination",
    description: "You will not receive degraded service, higher prices, or reduced functionality for exercising your CCPA rights.",
  },
] as const;

export default function CcpaNoticePage() {
  return (
    <PublicPageShell
      eyebrow="Legal · California residents"
      title="California Privacy Notice"
      description="This notice applies to California residents and describes your rights under the California Consumer Privacy Act (CCPA), as amended by the California Privacy Rights Act (CPRA)."
    >
      <div className="grid gap-4 md:grid-cols-2">
        {highlights.map((item) => (
          <div key={item.title} className="rounded-2xl border bg-muted/30 p-5">
            <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <item.icon className="h-5 w-5" />
            </div>
            <h2 className="text-base font-semibold text-foreground">{item.title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>
          </div>
        ))}
      </div>

      <PublicSection title="Categories of personal information we collect">
        <p>Over the last twelve months, LocateFlow may have collected the following categories of personal information:</p>
        <ul className="list-disc space-y-1 pl-6">
          <li>Identifiers — name, email, account ID.</li>
          <li>Commercial information — subscription plan, billing status.</li>
          <li>Internet / network activity — product usage, device metadata, error diagnostics.</li>
          <li>Geolocation-related data — addresses you add to the product (provided by you).</li>
          <li>Inferences — service and provider recommendations derived from the data you enter.</li>
          <li>Move workflow information - addresses, services, custom providers, move tasks, notes, and support records you create.</li>
        </ul>
      </PublicSection>

      <PublicSection title="Why we collect it">
        <p>
          To operate the service (create an account, store your addresses and services, generate moving tasks and checklists), to process billing, to keep the product secure, to comply with law, and to improve the product experience.
        </p>
      </PublicSection>

      <PublicSection title="How we disclose it">
        <p>
          LocateFlow discloses limited personal information to trusted service providers bound by contract — for hosting, authentication, payments, transactional email, and error monitoring. See the <a href="/privacy" className="underline">Privacy Policy</a> and the <a href="/dpa" className="underline">DPA</a> for the complete picture.
        </p>
        <p>
          LocateFlow <strong>does not sell</strong> personal information for money or other valuable consideration, and <strong>does not share</strong> it for cross-context behavioral advertising.
        </p>
      </PublicSection>

      <PublicSection title="Your California rights">
        <ul className="list-disc space-y-1 pl-6">
          <li><strong>Right to know</strong> — what personal information we hold about you, its sources, purposes, and recipients.</li>
          <li><strong>Right to delete</strong> — subject to legal and fraud-prevention exceptions.</li>
          <li><strong>Right to correct</strong> — inaccurate personal information.</li>
          <li><strong>Right to opt out</strong> — of sale or sharing (not applicable here, since we do neither).</li>
          <li><strong>Right to limit</strong> — use of sensitive personal information beyond what is reasonably necessary.</li>
          <li><strong>Right to non-discrimination</strong> — you will not receive degraded service or pricing for exercising any of these rights.</li>
        </ul>
      </PublicSection>

      <PublicSection title="How to submit a request">
        <p>
          Use <em>Settings → Privacy &amp; Security → Privacy tools</em> to submit a verified CCPA request inside the app. You can also email us via the <a href="/contact" className="underline">Contact page</a>. We will verify your identity before acting on a rights request and will respond within the timeframe required by law.
        </p>
        <p>
          Authorized agents acting on your behalf must provide written proof of authorization. We may still require the underlying consumer to verify their identity directly.
        </p>
      </PublicSection>

      <PublicSection title="Retention">
        <p>
          Personal information is retained for as long as your account is active and as needed to provide the service, resolve disputes, enforce agreements, and comply with legal obligations. See the <a href="/privacy" className="underline">Privacy Policy</a> for more on retention windows.
        </p>
      </PublicSection>
    </PublicPageShell>
  );
}
