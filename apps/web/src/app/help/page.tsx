import { AppShell } from "@/components/layout/app-shell";
import { HelpCenterContent } from "@/components/help/help-center-content";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { getHelpContent } from "@/lib/help-content";
import { createPublicPageMetadata } from "@/lib/seo";
import { getUserSession } from "@/lib/user-auth";
import { loadShowBudgetPreference } from "@/lib/user-preferences";
import { getLocale } from "next-intl/server";

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

const HELP_PAGE_COPY = {
  en: {
    eyebrow: "Help Center",
    title: "Search LocateFlow guides and FAQs.",
    subtitle:
      "Public help for addresses, services, moving tasks, billing, privacy, account security, and support workflows.",
  },
  es: {
    eyebrow: "Centro de ayuda",
    title: "Busca guias y preguntas frecuentes de LocateFlow.",
    subtitle:
      "Ayuda publica para direcciones, servicios, tareas de mudanza, facturacion, privacidad, seguridad de cuenta y soporte.",
  },
} as const;

export default async function HelpPage() {
  const locale = await getLocale();
  const copy = locale.toLowerCase().startsWith("es") ? HELP_PAGE_COPY.es : HELP_PAGE_COPY.en;
  const [content, shellState] = await Promise.all([
    getHelpContent(locale),
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
              {copy.eyebrow}
            </p>
            <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight text-foreground sm:text-5xl">
              {copy.title}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
              {copy.subtitle}
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
