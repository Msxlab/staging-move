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
  const tPricing = await getTranslations("pricing");

  const navLinks = [
    { href: "/#features", label: "Features" },
    { href: "/#pricing", label: tPricing("title").split(".")[0] },
    { href: "/how-it-works", label: tLanding("section_how_title") },
    { href: "/blog", label: "Blog" },
    { href: "/faq", label: "FAQ" },
  ];

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <Wordmark />
        <nav className="hidden items-center gap-6 md:flex">
          <Link href="/#features" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            Features
          </Link>
          <Link href="/#pricing" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            {tPricing("title").split(".")[0]}
          </Link>
          <Link href="/how-it-works" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            {tLanding("section_how_title")}
          </Link>
          <Link href="/blog" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            Blog
          </Link>
          <Link href="/faq" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            FAQ
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
