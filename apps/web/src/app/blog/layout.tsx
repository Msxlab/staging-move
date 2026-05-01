import type { ReactNode } from "react";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { MarketingFooter } from "@/components/marketing/marketing-footer";

/**
 * Shared chrome for the public blog. Wraps the list + detail views in
 * the same marketing header/footer the rest of the site uses, so the
 * blog visually belongs to the product instead of looking like a stray
 * subdomain. Token-based preview pages live under `/blog/preview/...`
 * and can opt out of this layout if they ever need to (they don't yet).
 */
export default function BlogLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <MarketingHeader />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  );
}
