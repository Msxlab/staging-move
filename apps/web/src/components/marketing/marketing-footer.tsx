import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LogoMark } from "@/components/marketing/logo";

export async function MarketingFooter() {
  const tCommon = await getTranslations("common");
  const tLanding = await getTranslations("landing");
  const tLegal = await getTranslations("legal");
  const tPricing = await getTranslations("pricing");

  return (
    <footer className="border-t py-12">
      <div className="container">
        <div className="mb-8 grid grid-cols-1 gap-8 md:grid-cols-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <LogoMark size={24} />
              <span className="font-semibold">LocateFlow</span>
            </div>
            <p className="text-sm text-muted-foreground">{tCommon("tagline")}</p>
          </div>
          <div>
            <h4 className="mb-3 text-sm font-semibold">Product</h4>
            <div className="space-y-2 text-sm text-muted-foreground">
              <Link href="/#features" className="block transition hover:text-foreground">{tLanding("section_features_title")}</Link>
              <Link href="/pricing" className="block transition hover:text-foreground">{tPricing("title")}</Link>
              <Link href="/how-it-works" className="block transition hover:text-foreground">{tLanding("section_how_title")}</Link>
              <Link href="/blog" className="block transition hover:text-foreground">Blog</Link>
              <Link href="/faq" className="block transition hover:text-foreground">FAQ</Link>
            </div>
          </div>
          <div>
            <h4 className="mb-3 text-sm font-semibold">{tCommon("privacy")} / {tCommon("terms")}</h4>
            <div className="space-y-2 text-sm text-muted-foreground">
              <Link href="/privacy" className="block transition hover:text-foreground">{tLegal("privacy_title")}</Link>
              <Link href="/terms" className="block transition hover:text-foreground">{tLegal("terms_title")}</Link>
              <Link href="/cookie-policy" className="block transition hover:text-foreground">{tLegal("cookie_title")}</Link>
              <Link href="/disclaimer" className="block transition hover:text-foreground">{tLegal("disclaimer_title")}</Link>
              <Link href="/billing-policy" className="block transition hover:text-foreground">Billing policy</Link>
              <Link href="/refund" className="block transition hover:text-foreground">Refund policy</Link>
              <Link href="/acceptable-use" className="block transition hover:text-foreground">Acceptable use</Link>
              <Link href="/dpa" className="block transition hover:text-foreground">DPA</Link>
              <Link href="/security" className="block transition hover:text-foreground">Security</Link>
              <Link href="/ccpa-privacy-notice" className="block transition hover:text-foreground">California privacy</Link>
            </div>
          </div>
          <div>
            <h4 className="mb-3 text-sm font-semibold">{tCommon("help")}</h4>
            <div className="space-y-2 text-sm text-muted-foreground">
              <Link href="/faq" className="block transition hover:text-foreground">FAQ</Link>
              <Link href="/blog" className="block transition hover:text-foreground">Blog</Link>
              <Link href="/blog/feed.xml" className="block transition hover:text-foreground">RSS</Link>
              <Link href="/contact" className="block transition hover:text-foreground">{tCommon("contact")}</Link>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-center justify-between gap-4 border-t pt-6 md:flex-row">
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} LocateFlow. {tCommon("privacy")}.
          </p>
          <p className="text-xs text-muted-foreground">{tLanding("footer_tagline")}</p>
        </div>
      </div>
    </footer>
  );
}
