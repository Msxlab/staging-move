import Link from "next/link";
import { Trash2, ShieldAlert, Mail, Smartphone } from "lucide-react";
import { PublicPageShell, PublicSection } from "@/components/marketing/public-page-shell";
import { createPublicPageMetadata } from "@/lib/seo";
import { LEGAL_CONTACTS, mailto } from "@/lib/legal-info";

export const metadata = createPublicPageMetadata({
  title: "Delete your Move account",
  description:
    "Request permanent deletion of your Move account and personal data. Works for email/password, Google, and Apple sign-in accounts.",
  path: "/account/delete",
});

export default function AccountDeletionPage() {
  return (
    <PublicPageShell
      eyebrow="Account"
      title="Delete your Move account"
      description="You can permanently delete your Move account and the personal data we hold for you. This page describes the in-app deletion path and the email-based request path for users who cannot access the app."
    >
      <PublicSection title="Fastest path: delete from inside the app">
        <ol className="list-decimal space-y-2 pl-6">
          <li>Open the Move mobile app or sign in to <Link href="/dashboard" className="underline">locateflow.com</Link> on the web.</li>
          <li>Open <strong>Settings → Privacy → Delete account</strong>.</li>
          <li>Type the confirmation phrase (<code>DELETE</code> in English, <code>ELIMINAR</code> in Spanish).</li>
          <li>
            Email/password users: enter your current password.<br />
            Google or Apple sign-in users: the typed confirmation is enough — no password setup is required.
          </li>
          <li>Tap <strong>Delete permanently</strong>. Deletion begins immediately.</li>
        </ol>
        <div className="rounded-2xl border bg-muted/30 p-4 text-sm leading-6">
          <div className="flex items-start gap-3">
            <Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
            <p>
              The in-app option is available to all users, including those who signed up with Google or Apple. You do not need to set a password to delete your account.
            </p>
          </div>
        </div>
      </PublicSection>

      <PublicSection title="Cannot sign in? Request deletion by email">
        <p>
          If you have lost access to your account and cannot sign in to delete it yourself, send an email
          to <a href={mailto(LEGAL_CONTACTS.privacy, "Move account deletion request")} className="underline">{LEGAL_CONTACTS.privacy}</a> from
          the email address registered with Move.
        </p>
        <p>Please include:</p>
        <ul className="list-disc space-y-1 pl-6">
          <li>The subject line <strong>“Account deletion request”</strong>.</li>
          <li>The email address you used to sign up.</li>
          <li>Whether you signed in with email/password, Google, or Apple.</li>
        </ul>
        <p>
          For security we will respond from the same address with a confirmation link. Clicking the link confirms the request and starts deletion. Without that confirmation we cannot act on the request, because we cannot verify the sender owns the account.
        </p>
        <p>
          We will not act on requests we cannot tie to a verified account. We will not confirm or deny whether a particular email address is registered.
        </p>
      </PublicSection>

      <PublicSection title="What is deleted">
        <ul className="list-disc space-y-1 pl-6">
          <li>Account, profile, and authentication identifiers (email, name, password hash, OAuth identifiers).</li>
          <li>Addresses, moves, services, custom providers, checklists, tasks, budget entries, and documents you created.</li>
          <li>Support tickets, support messages, and privacy/security requests you submitted.</li>
          <li>Push notification tokens and per-device session records.</li>
          <li>Analytics events and crash logs tied to your account identifier.</li>
          <li>App preferences, consent records, and notification subscriptions tied to your account.</li>
        </ul>
      </PublicSection>

      <PublicSection title="What may be retained">
        <p>The following data may be retained only as required by law, fraud-prevention practice, or financial compliance, even after deletion:</p>
        <ul className="list-disc space-y-1 pl-6">
          <li>Billing, invoice, and receipt records required by tax and accounting law.</li>
          <li>Subscription metadata held by Apple App Store or Google Play that Move cannot delete directly. Use Apple ID and Google Play account tools to cancel and remove these.</li>
          <li>Audit logs and security event records required to investigate abuse or comply with legal process.</li>
          <li>Backups, which roll off on a normal schedule (typically within 30 days).</li>
          <li>Aggregated or fully de-identified usage statistics that cannot be linked back to you.</li>
        </ul>
        <p>This matches the “Retention, export, and deletion” section of the <Link href="/privacy" className="underline">Privacy Policy</Link>.</p>
      </PublicSection>

      <PublicSection title="Timeline">
        <ul className="list-disc space-y-1 pl-6">
          <li>In-app deletion: starts immediately. Account access is revoked at the moment of deletion. Full data removal completes within a few minutes; remaining cleanup (large object storage, processor records) finishes within 30 days.</li>
          <li>Email-based request: starts once you click the verification link in our response, typically within 1 business day. Full data removal completes within 30 days of confirmation.</li>
          <li>Backups: rolled off within 30 days of deletion.</li>
        </ul>
      </PublicSection>

      <PublicSection title="Subscriptions, refunds, and store billing">
        <div className="rounded-2xl border bg-muted/30 p-4 text-sm leading-6">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
            <p>
              Deleting your Move account does <strong>not</strong> automatically cancel a subscription billed by Apple or Google Play. Cancel the subscription in your Apple ID / Google Play subscriptions page first; otherwise renewal charges may continue until the store cancels billing. Stripe-billed web subscriptions are cancelled as part of Move account deletion.
            </p>
          </div>
        </div>
      </PublicSection>

      <PublicSection title="Other privacy rights">
        <p>
          You may also export, correct, or restrict processing of your data. See the <Link href="/privacy" className="underline">Privacy Policy</Link> and, for California residents, the <Link href="/ccpa-privacy-notice" className="underline">California Privacy Notice</Link>.
        </p>
        <p>
          For deletion or privacy questions:{" "}
          <a href={mailto(LEGAL_CONTACTS.privacy, "Move privacy request")} className="underline">
            {LEGAL_CONTACTS.privacy}
          </a>.
          For general support:{" "}
          <a href={mailto(LEGAL_CONTACTS.support, "Move support")} className="underline">
            {LEGAL_CONTACTS.support}
          </a>.
        </p>
      </PublicSection>

      <div className="mt-8 flex flex-col gap-3 rounded-2xl border bg-muted/30 p-5 text-sm leading-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <Trash2 className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden />
          <p>Already signed in? Open the in-app deletion screen now.</p>
        </div>
        <Link
          href="/settings/privacy"
          className="inline-flex items-center justify-center rounded-xl border border-destructive bg-destructive/10 px-4 py-2 font-medium text-destructive hover:bg-destructive/15"
        >
          Open privacy settings
        </Link>
      </div>

      <div className="mt-2 text-sm text-muted-foreground">
        <Mail className="mr-2 inline h-4 w-4 align-text-bottom" aria-hidden />
        Trouble with deletion? Email <a href={mailto(LEGAL_CONTACTS.support, "Move account deletion help")} className="underline">{LEGAL_CONTACTS.support}</a>.
      </div>
    </PublicPageShell>
  );
}
