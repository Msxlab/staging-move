import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { getUserSession } from "@/lib/user-auth";
import { LandingThemeToggle } from "@/components/marketing/landing-theme-toggle";
import { Wordmark } from "@/components/marketing/logo";
import { LanguageSelector } from "@/components/language-selector";
import { MarketingUserMenu } from "@/components/marketing/marketing-user-menu";
import { MarketingMobileNav } from "@/components/marketing/marketing-mobile-nav";

type MarketingHeaderProps = {
  userId?: string | null;
};

export async function MarketingHeader({ userId: providedUserId }: MarketingHeaderProps = {}) {
  const session = providedUserId === undefined ? await getUserSession() : null;
  const userId = providedUserId === undefined ? session?.userId ?? null : providedUserId;
  const tCommon = await getTranslations("common");
  const tLanding = await getTranslations("landing");

  // Nav restyled to the Move web design (Web.dc.html) pill style, leading with
  // Features / Pricing / Guides. Pricing stays while the paid model is active on
  // this branch; the design's free nav (swap Pricing → "Why free") rides the
  // CONSUMER_FREE pivot flag, which lives on a separate branch — wire it there,
  // not hardcoded here.
  const navLinks = [
    { href: "/features", label: "Features" },
    { href: "/why-free", label: "Why free" },
    { href: "/blog", label: "Guides" },
    { href: "/faq", label: "FAQ" },
  ];

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <Wordmark />
        <nav className="hidden items-center gap-1 md:flex">
          <Link
            href="/features"
            className="rounded-lg px-3.5 py-2 text-[13.5px] font-semibold text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
          >
            Features
          </Link>
          <Link
            href="/why-free"
            className="rounded-lg px-3.5 py-2 text-[13.5px] font-semibold text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
          >
            Why free
          </Link>
          <Link
            href="/blog"
            className="rounded-lg px-3.5 py-2 text-[13.5px] font-semibold text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
          >
            Guides
          </Link>
        </nav>
        <div className="flex items-center gap-1 md:gap-2">
          <MarketingMobileNav
            links={navLinks}
            userId={userId}
            signInLabel={tCommon("signIn")}
            signUpLabel={tLanding("heroCta")}
            menuLabel="Menu"
          />
          <LanguageSelector variant="icon" />
          <LandingThemeToggle variant="compact" />
          {userId ? (
            <MarketingUserMenu />
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/sign-in">{tCommon("signIn")}</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/sign-up">{tLanding("heroCta")}</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
