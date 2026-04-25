import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { getUserSession } from "@/lib/user-auth";
import { LandingThemeToggle } from "@/components/marketing/landing-theme-toggle";
import { Wordmark } from "@/components/marketing/logo";

type MarketingHeaderProps = {
  userId?: string | null;
};

export async function MarketingHeader({ userId: providedUserId }: MarketingHeaderProps = {}) {
  const session = providedUserId === undefined ? await getUserSession() : null;
  const userId = providedUserId === undefined ? session?.userId ?? null : providedUserId;
  const tCommon = await getTranslations("common");
  const tLanding = await getTranslations("landing");
  const tNav = await getTranslations("nav");
  const tPricing = await getTranslations("pricing");

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
          <Link href="/faq" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            FAQ
          </Link>
        </nav>
        <div className="flex items-center gap-1 md:gap-2">
          <LandingThemeToggle />
          {userId ? (
            <>
              <Link href="/dashboard" className="hidden sm:block">
                <Button variant="ghost" size="sm">{tNav("dashboard")}</Button>
              </Link>
              <Link href="/dashboard">
                <Button size="sm">{tNav("dashboard")}</Button>
              </Link>
            </>
          ) : (
            <>
              <Link href="/sign-in">
                <Button variant="ghost" size="sm">{tCommon("signIn")}</Button>
              </Link>
              <Link href="/sign-up">
                <Button size="sm">{tLanding("heroCta")}</Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
