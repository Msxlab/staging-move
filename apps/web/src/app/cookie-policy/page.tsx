import type { Metadata } from "next";
import { Cookie, LockKeyhole, MonitorSmartphone, SlidersHorizontal } from "lucide-react";
import { PublicPageShell, PublicSection } from "@/components/marketing/public-page-shell";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description: "How LocateFlow uses cookies and browser storage.",
  alternates: {
    canonical: "/cookie-policy",
  },
};

const highlights = [
  {
    icon: Cookie,
    title: "Essential cookies",
    description: "Core browser storage and cookies may be used to keep sessions, authentication, and app navigation working correctly.",
  },
  {
    icon: LockKeyhole,
    title: "Security uses",
    description: "Security protections may rely on temporary tokens, session controls, or request validation to help protect accounts and APIs.",
  },
  {
    icon: SlidersHorizontal,
    title: "Preference storage",
    description: "Theme choices, onboarding state, and other product preferences may be stored locally to improve continuity across visits.",
  },
  {
    icon: MonitorSmartphone,
    title: "Device experience",
    description: "Some browser storage is used to support responsive experiences, installs, and product behavior across devices.",
  },
] as const;

export default function CookiePolicyPage() {
  return (
    <PublicPageShell
      eyebrow="Legal"
      title="Cookie Policy"
      description="This page explains the limited ways LocateFlow may use cookies or browser storage to operate sign-in, security, and product experience features."
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

      <PublicSection title="What LocateFlow may store in the browser">
        <p>
          LocateFlow may use cookies, local storage, and similar browser mechanisms for essential product needs such as sign-in state, security validation, preferences, app installation prompts, and continuity between visits.
        </p>
      </PublicSection>

      <PublicSection title="Why this storage is used">
        <p>
          Browser storage helps maintain secure sessions, remember user-facing preferences, support navigation, and reduce unnecessary friction when returning to the app.
        </p>
        <p>
          If third-party integrations such as authentication, billing, or infrastructure tooling are enabled, those providers may also use their own cookies or device identifiers as part of their services.
        </p>
      </PublicSection>

      <PublicSection title="Managing cookies and storage">
        <p>
          Most browsers let you clear cookies, remove site storage, or block future storage. Doing so can affect sign-in, remembered settings, and other product behaviors that rely on those mechanisms.
        </p>
      </PublicSection>
    </PublicPageShell>
  );
}
