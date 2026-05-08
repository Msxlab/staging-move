import { requirePageRole } from "@/lib/page-guard";
import RuntimeConfigClient from "./runtime-config-client";

// Runtime config can rotate JWT secrets, Redis URLs, Stripe keys,
// imgproxy keys, encryption keys, etc. SUPER_ADMIN only — and the gate
// runs server-side so unauthorized roles never receive the masked-value
// catalog at all.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Runtime Config — Admin",
  robots: { index: false, follow: false },
};

export default async function RuntimeConfigPage() {
  await requirePageRole("SUPER_ADMIN");
  return <RuntimeConfigClient />;
}
