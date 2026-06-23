import { requirePageAdmin } from "@/lib/page-guard";
import TwoFactorClient from "./two-factor-client";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function TwoFactorPage() {
  await requirePageAdmin();
  return <TwoFactorClient />;
}
