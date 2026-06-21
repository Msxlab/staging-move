import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LanguageSelector } from "@/components/language-selector";
import { LogoMark } from "@/components/marketing/logo";
import { LandingThemeToggle } from "@/components/marketing/landing-theme-toggle";

export async function MarketingFooter() {
  const tCommon = await getTranslations("common");
  const tLanding = await getTranslations("landing");
  const tLegal = await getTranslations("legal");
  const tPricing = await getTranslations("pricing");

  return (
    <footer className="border-t border-border bg-card py-12">
      <div className="container">
        <div className="mb-6 flex justify-end">
          <LandingThemeToggle />
        </div>
        <div className="mb-8 grid grid-cols-1 gap-8 md:grid-cols-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <LogoMark size={24} />
              <span className="font-display text-lg font-bold">Move</span>
            </div>
            <p className="text-sm text-muted-foreground">{tCommon("tagline")}</p>
          </div>
          <div>
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Product</h4>
            <div className="space-y-2 text-sm text-muted-foreground">
              <Link href="/about" className="block transition hover:text-primary">About</Link>
              <Link href="/features" className="block transition hover:text-primary">{tLanding("section_features_title")}</Link>
              <Link href="/why-free" className="block transition hover:text-primary">Why free</Link>
              <Link href="/pricing" className="block transition hover:text-primary">{tPricing("title")}</Link>
              <Link href="/how-it-works" className="block transition hover:text-primary">{tLanding("section_how_title")}</Link>
              <Link href="/provider-coverage" className="block transition hover:text-primary">Provider coverage</Link>
              <Link href="/blog" className="block transition hover:text-primary">Blog</Link>
              <Link href="/faq" className="block transition hover:text-primary">FAQ</Link>
            </div>
          </div>
          <div>
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{tCommon("privacy")} / {tCommon("terms")}</h4>
            <div className="space-y-2 text-sm text-muted-foreground">
              <Link href="/privacy" className="block transition hover:text-primary">{tLegal("privacy_title")}</Link>
              <Link href="/terms" className="block transition hover:text-primary">{tLegal("terms_title")}</Link>
              <Link href="/cookie-policy" className="block transition hover:text-primary">{tLegal("cookie_title")}</Link>
              <Link href="/disclaimer" className="block transition hover:text-primary">{tLegal("disclaimer_title")}</Link>
              <Link href="/billing-policy" className="block transition hover:text-primary">Billing policy</Link>
              <Link href="/refund" className="block transition hover:text-primary">Refund policy</Link>
              <Link href="/data-deletion" className="block transition hover:text-primary">Data export and deletion</Link>
              <Link href="/acceptable-use" className="block transition hover:text-primary">Acceptable use</Link>
              <Link href="/dpa" className="block transition hover:text-primary">DPA</Link>
              <Link href="/security" className="block transition hover:text-primary">Security</Link>
              <Link href="/ccpa-privacy-notice" className="block transition hover:text-primary">California privacy</Link>
            </div>
          </div>
          <div>
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{tCommon("help")}</h4>
            <div className="space-y-2 text-sm text-muted-foreground">
              <Link href="/faq" className="block transition hover:text-primary">FAQ</Link>
              <Link href="/help" className="block transition hover:text-primary">Help Center</Link>
              <Link href="/blog" className="block transition hover:text-primary">Blog</Link>
              <Link href="/blog/feed.xml" className="block transition hover:text-primary">RSS</Link>
              <Link href="/contact" className="block transition hover:text-primary">{tCommon("contact")}</Link>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-center justify-between gap-4 border-t border-border pt-6 md:flex-row">
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} Move. {tCommon("privacy")}.
          </p>
          <div className="flex items-center gap-2">
            <LanguageSelector variant="icon" />
            <LandingThemeToggle />
          </div>
          <p className="text-xs text-muted-foreground">{tLanding("footer_tagline")}</p>
        </div>
      </div>
    </footer>
  );
}
