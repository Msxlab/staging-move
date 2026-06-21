import Link from "next/link";
import { PublicPageShell, PublicSection } from "@/components/marketing/public-page-shell";
import { JsonLd, breadcrumbSchema } from "@/components/seo/json-ld";
import { absoluteUrl, createPublicPageMetadata, SITE_URL } from "@/lib/seo";
import { LEGAL_CONTACTS, mailto, policyLastUpdatedLabel } from "@/lib/legal-info";

export const metadata = createPublicPageMetadata({
  title: "Data Export and Deletion",
  description:
    "How Move users can request account data export or deletion, and what records may need to be retained.",
  path: "/data-deletion",
});

export default function DataDeletionPage() {
  return (
    <>
      <JsonLd
        id="ld-data-deletion-breadcrumb"
        data={breadcrumbSchema([
          { name: "Home", url: SITE_URL },
          { name: "Data export and deletion", url: absoluteUrl("/data-deletion") },
        ])}
      />
      <PublicPageShell
        eyebrow="Privacy"
        title="Data export and deletion"
        description="Move provides account export and deletion workflows, with practical limits for backups, billing, audit, legal, security, and processor records."
      >
        <div className="rounded-2xl border border-border bg-card p-5 text-sm leading-6 text-muted-foreground">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">{policyLastUpdatedLabel()}</p>
        </div>

        <PublicSection title="Exporting account data">
          <p>
            Signed-in users can use account settings to export supported account
            records, such as saved addresses, services, moving tasks, and related
            account data. Export availability can depend on the account state,
            product surface, and operational limits.
          </p>
        </PublicSection>

        <PublicSection title="Requesting deletion">
          <p>
            Signed-in users can request account deletion from account settings where
            the workflow is available. Account-specific requests may require sign-in
            so Move can confirm the account and protect against unauthorized
            deletion.
          </p>
          <p>
            If you cannot sign in, contact{" "}
            <a href={mailto(LEGAL_CONTACTS.privacy, "LocateFlow data deletion request")} className="text-primary underline">
              {LEGAL_CONTACTS.privacy}
            </a>{" "}
            with enough information for Move to review the request without
            sending passwords, payment card numbers, private keys, or unnecessary
            sensitive records.
          </p>
        </PublicSection>

        <PublicSection title="Records that may be retained">
          <p>
            A deletion request may remove active account records where supported.
            Some information may remain when needed for backups, billing records,
            audit logs, legal obligations, fraud prevention, security investigation,
            processor records, dispute handling, or service integrity.
          </p>
          <p>
            See the <Link href="/privacy" className="text-primary underline">Privacy Policy</Link>{" "}
            and <Link href="/ccpa-privacy-notice" className="text-primary underline">California Privacy Notice</Link>{" "}
            for more detail on rights, retention, and request handling.
          </p>
        </PublicSection>

        <PublicSection title="Store subscriptions">
          <p>
            Deleting a Move account does not necessarily cancel subscriptions
            managed by Apple App Store or Google Play. Store subscriptions must be
            managed through the applicable store. Web subscriptions can be managed
            through supported account settings or the Stripe billing portal.
          </p>
        </PublicSection>
      </PublicPageShell>
    </>
  );
}
