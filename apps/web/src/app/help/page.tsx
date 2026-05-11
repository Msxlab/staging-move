import { AppShell } from "@/components/layout/app-shell";
import { HelpCenterContent } from "@/components/help/help-center-content";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { getHelpContent } from "@/lib/help-content";
import { createPublicPageMetadata } from "@/lib/seo";
import { getUserSession } from "@/lib/user-auth";
import { loadShowBudgetPreference } from "@/lib/user-preferences";

export const dynamic = "force-dynamic";

export const metadata = createPublicPageMetadata({
  title: "Help Center",
  description:
    "Search LocateFlow help articles and FAQs about addresses, services, moving tasks, billing, privacy, account security, and support.",
  path: "/help",
});

async function getLoggedInShellState() {
  const session = await getUserSession().catch(() => null);
  if (!session?.userId) return null;

  return { showBudget: await loadShowBudgetPreference(session.userId).catch(() => true) };
}

export default async function HelpPage() {
  const [content, shellState] = await Promise.all([
    getHelpContent(),
    getLoggedInShellState(),
  ]);

  if (shellState) {
    return (
      <AppShell showBudget={shellState.showBudget}>
        <HelpCenterContent articles={content.articles} faqs={content.faqs} />
      </AppShell>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <MarketingHeader userId={null} />
      <main>
        <section className="border-b bg-card/40">
          <div className="container py-12 sm:py-16">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
              Help Center
            </p>
            <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight text-foreground sm:text-5xl">
              Search LocateFlow guides and FAQs.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
              Public help for addresses, services, moving tasks, billing, privacy,
              account security, and support workflows.
            </p>
          </div>
        </section>
        <section className="container py-10 sm:py-14">
          <HelpCenterContent
            articles={content.articles}
            faqs={content.faqs}
            showHeading={false}
          />
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}
