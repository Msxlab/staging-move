import { requirePagePermission } from "@/lib/page-guard";
import SecurityClient from "./security-client";

// /security exposes IP rule management, GDPR requests, security readiness,
// and rate-limit logs. Reads need at least settings:canRead with an ADMIN
// floor — the page is gated server-side so VIEWER/MODERATOR cannot
// receive sensitive readiness details (missing required keys, etc.).
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Security — Admin",
  robots: { index: false, follow: false },
};

export default async function SecurityPage() {
  await requirePagePermission("settings", "canRead", { minimumRole: "ADMIN" });
  return <SecurityClient />;
}
