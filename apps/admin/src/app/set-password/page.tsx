import SetPasswordClient from "./set-password-client";

// Public (token-gated) landing page for the admin INVITE link. Reachable
// without a session — the single-use, expiring token in the URL is the
// authorization. Never indexed.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Set your password — Admin",
  robots: { index: false, follow: false },
};

export default function SetPasswordPage() {
  return <SetPasswordClient />;
}
