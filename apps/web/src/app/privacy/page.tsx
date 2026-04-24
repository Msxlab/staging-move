import type { Metadata } from "next";
import { Database, Lock, Shield, UserCheck } from "lucide-react";
import { PublicPageShell, PublicSection } from "@/components/marketing/public-page-shell";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How LocateFlow handles account, address, service, and moving data.",
  alternates: {
    canonical: "/privacy",
  },
};

const highlights = [
  {
    icon: Database,
    title: "Account and move data",
    description: "LocateFlow stores the profile, address, service, custom provider, move-task, and document data you create so the product can organize your relocation workflow.",
  },
  {
    icon: Shield,
    title: "Security and access control",
    description: "Authentication, access checks, and abuse protections are used to keep accounts and operational data protected.",
  },
  {
    icon: Lock,
    title: "Operational vendors",
    description: "Infrastructure providers may process data on LocateFlow's behalf to support authentication, payments, storage, notifications, and reliability.",
  },
  {
    icon: UserCheck,
    title: "User control",
    description: "You can update your account data in-app and use account-management flows when you need to review, export, or remove your data.",
  },
] as const;

export default function PrivacyPage() {
  return (
    <PublicPageShell
      eyebrow="Legal"
      title="Privacy Policy"
      description="This page explains, at a product level, how LocateFlow uses the data required to run account, address, service, and moving workflows."
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

      <PublicSection title="Information LocateFlow may collect">
        <p>
          Depending on how you use the product, LocateFlow may process account identity details, profile information, addresses, service provider selections, user-created custom providers, move tasks, moving-plan records, uploaded documents, subscriptions, and product activity required to operate the app.
        </p>
        <p>
          When authentication is enabled, sign-in and account identity are handled through the configured auth provider. Billing and operational tooling may also introduce limited data processing needed to run those features.
        </p>
      </PublicSection>

      <PublicSection title="How the data is used">
        <p>
          LocateFlow uses account and household data to create and maintain your move plan, match addresses with likely services, store your records, generate local move tasks, personalize recommendations, and keep your account secure.
        </p>
        <p>
          Product activity data may also be used for debugging, fraud prevention, system reliability, and understanding how the experience can be improved.
        </p>
      </PublicSection>

      <PublicSection title="Sharing and processors">
        <p>
          LocateFlow may rely on third-party providers for core platform operations such as authentication, file storage, payments, email delivery, and infrastructure. Those providers only receive the data required to perform the relevant service.
        </p>
        <p>
          LocateFlow is not designed as a public directory of your private household data. Your account records are intended to remain scoped to your account and authorized administrators or collaborators.
        </p>
      </PublicSection>

      <PublicSection title="Retention and user rights">
        <p>
          Data is generally retained for as long as your account and related workflows need it, or until you remove the relevant records. Some operational logs may be retained longer for security and auditing.
        </p>
        <p>
          If you need help with deletion, access, or correction requests, use the account settings available inside the app or the support routes listed in the Help Center.
        </p>
      </PublicSection>
    </PublicPageShell>
  );
}
