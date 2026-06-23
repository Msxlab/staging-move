import { requirePagePermission } from "@/lib/page-guard";
import WaitlistClient from "./waitlist-client";

// Waitlist surfaces signup PII (emails) plus outreach/conversion state.
// Server-gate at settings:canRead (ADMIN floor) — matching the page's own
// list API GET /api/waitlist (route.ts requirePermission). The API also
// OR-allows an audit_logs fallbackResource, which is not expressible via
// requirePagePermission; the page guard uses the stricter primary floor.
export const dynamic = "force-dynamic";

export const metadata = {
  robots: { index: false, follow: false },
};

export default async function WaitlistPage() {
  await requirePagePermission("settings", "canRead", { minimumRole: "ADMIN" });
  return <WaitlistClient />;
}
